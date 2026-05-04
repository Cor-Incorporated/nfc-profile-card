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
    const aliasDocs = await adminDb.getAll(...aliasRefs);
    const aliases = previousUsernames.map((username, index) => {
      const alias = aliasDocs[index];
      const aliasData = alias.exists ? alias.data() : null;
      const isRedirecting =
        aliasData?.uid === uid && aliasData?.status === "redirect";

      return {
        username,
        status: isRedirecting ? "redirect" : "disabled",
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

      if (action === "redirect") {
        transaction.set(aliasRef, {
          uid,
          username: aliasUsername,
          targetUsername: currentUsername,
          status: "redirect",
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: aliasDoc.exists
            ? aliasDoc.data()?.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
        });
      } else {
        transaction.delete(aliasRef);
      }

      return {
        username: aliasUsername,
        status: action === "redirect" ? "redirect" : "disabled",
        targetUsername: currentUsername,
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
