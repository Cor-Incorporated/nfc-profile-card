import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidLegacyAlias(username: string) {
  return (
    username.length >= 3 && username.length <= 150 && !username.includes("/")
  );
}

function normalizeAction(value: unknown) {
  return value === "redirect" ? "redirect" : "disable";
}

async function verifyRequest(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) return null;

  const verification = await verifyIdToken(token);
  return verification.success && verification.uid ? verification.uid : null;
}

function getPreviousUsernames(data: DocumentData | undefined) {
  const previous = Array.isArray(data?.previousUsernames)
    ? data?.previousUsernames
    : [];
  const current = normalizeUsername(data?.username);
  return Array.from(
    new Set(
      previous
        .map(normalizeUsername)
        .filter((username) => username && username !== current),
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const uid = await verifyRequest(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userDoc.data();
    const currentUsername = normalizeUsername(data?.username);
    const previousUsernames = getPreviousUsernames(data);

    if (previousUsernames.length === 0) {
      return NextResponse.json({
        currentUsername,
        aliases: [],
      });
    }

    const aliasRefs = previousUsernames.map((username) =>
      adminDb.collection("usernameAliases").doc(username),
    );
    const reservationRefs = previousUsernames.map((username) =>
      adminDb.collection("usernames").doc(username),
    );
    const allDocs = await adminDb.getAll(...aliasRefs, ...reservationRefs);
    const aliasDocs = allDocs.slice(0, previousUsernames.length);
    const reservationDocs = allDocs.slice(previousUsernames.length);
    const aliases = previousUsernames.map((username, index) => {
      const alias = aliasDocs[index];
      const aliasData = alias.exists ? alias.data() : null;
      const reservation = reservationDocs[index];
      const fixedPathCanBeManaged =
        !username.startsWith("u_") || username === `u_${uid}`;
      const canManage =
        fixedPathCanBeManaged &&
        (aliasData?.uid === uid ||
          (reservation.exists && reservation.data()?.uid === uid));
      const isRedirecting = canManage && aliasData?.status === "redirect";

      return {
        username,
        status: isRedirecting ? "redirect" : "disabled",
        canManage,
        targetUsername: isRedirecting
          ? aliasData?.targetUsername || currentUsername
          : currentUsername,
      };
    });

    return NextResponse.json({
      currentUsername,
      aliases,
    });
  } catch (error) {
    console.error("Failed to fetch username aliases:", error);
    return NextResponse.json(
      { error: "username_alias_fetch_failed" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const uid = await verifyRequest(request);
    if (!uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const aliasUsername = normalizeUsername(body.aliasUsername);
    const action = normalizeAction(body.action);

    if (!isValidLegacyAlias(aliasUsername)) {
      return NextResponse.json({ error: "username_invalid" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data();
      const currentUsernameRaw =
        typeof userData?.username === "string" ? userData.username.trim() : "";
      const currentUsername = normalizeUsername(userData?.username);
      const previousUsernames = getPreviousUsernames(userData);

      if (
        aliasUsername === currentUsername ||
        !previousUsernames.includes(aliasUsername)
      ) {
        throw new Error("ALIAS_NOT_ALLOWED");
      }

      const usernameRef = adminDb.collection("usernames").doc(aliasUsername);
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists && usernameDoc.data()?.uid !== uid) {
        throw new Error("ALIAS_TAKEN");
      }

      const aliasRef = adminDb.collection("usernameAliases").doc(aliasUsername);
      const aliasDoc = await transaction.get(aliasRef);
      if (aliasDoc.exists && aliasDoc.data()?.uid !== uid) {
        throw new Error("ALIAS_TAKEN");
      }
      if (!usernameDoc.exists && !aliasDoc.exists) {
        // Legacy history alone was client-writable before the ownership rules.
        throw new Error("ALIAS_NOT_ALLOWED");
      }

      if (aliasUsername.startsWith("u_")) {
        const fallbackUid = aliasUsername.slice(2);
        if (fallbackUid !== uid) {
          throw new Error("ALIAS_TAKEN");
        }
        const directUidDoc = await transaction.get(
          adminDb.collection("users").doc(fallbackUid),
        );
        if (directUidDoc.exists && directUidDoc.id !== uid) {
          throw new Error("ALIAS_TAKEN");
        }
      }

      // Older clients could edit previousUsernames directly. Do not let a
      // forged history claim another user's active legacy profile URL.
      const legacyOwners = await transaction.get(
        adminDb
          .collection("users")
          .where("username", "==", aliasUsername)
          .limit(2),
      );
      if (legacyOwners.docs.some((owner) => owner.id !== uid)) {
        throw new Error("ALIAS_TAKEN");
      }

      if (action === "redirect") {
        const currentReservation = await transaction.get(
          adminDb.collection("usernames").doc(currentUsername),
        );
        if (
          currentUsernameRaw === `u_${uid}`
            ? currentReservation.exists &&
              currentReservation.data()?.uid !== uid
            : !currentReservation.exists ||
              currentReservation.data()?.uid !== uid
        ) {
          throw new Error("ALIAS_NOT_ALLOWED");
        }
      }

      if (usernameDoc.exists) transaction.delete(usernameRef);

      transaction.set(aliasRef, {
        uid,
        username: aliasUsername,
        ...(action === "redirect"
          ? { targetUsername: currentUsernameRaw }
          : {}),
        status: action === "redirect" ? "redirect" : "disabled",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: aliasDoc.exists
          ? aliasDoc.data()?.createdAt || FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
      });

      return {
        username: aliasUsername,
        status: action === "redirect" ? "redirect" : "disabled",
        targetUsername: currentUsernameRaw,
        canManage: true,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ alias: result });
  } catch (error) {
    if (error instanceof Error && error.message === "ALIAS_TAKEN") {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }

    if (error instanceof Error && error.message === "ALIAS_NOT_ALLOWED") {
      return NextResponse.json({ error: "alias_not_allowed" }, { status: 400 });
    }

    console.error("Failed to update username alias:", error);
    return NextResponse.json(
      { error: "username_alias_update_failed" },
      { status: 500 },
    );
  }
}
