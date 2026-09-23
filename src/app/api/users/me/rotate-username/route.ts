import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import { generateDefaultUsername } from "@/lib/username";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

function normalizeLegacyUrlAction(value: unknown) {
  return value === "redirect" ? "redirect" : "disable";
}

async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = generateDefaultUsername();
    const usernameDoc = await adminDb
      .collection("usernames")
      .doc(username.toLowerCase())
      .get();
    if (usernameDoc.exists) {
      continue;
    }
    const aliasDoc = await adminDb
      .collection("usernameAliases")
      .doc(username.toLowerCase())
      .get();
    if (aliasDoc.exists) continue;

    const snapshot = await adminDb
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return username;
    }
  }

  throw new Error("Failed to generate unique username");
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verification = await verifyIdToken(token);
    if (!verification.success || !verification.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch {}
    const legacyUrlAction = normalizeLegacyUrlAction(body.legacyUrlAction);

    const userRef = adminDb.collection("users").doc(verification.uid);
    const username = await generateUniqueUsername();
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data() || {};
      const previousUsername =
        typeof data.username === "string" &&
        !data.username.includes("/") &&
        data.username.length <= 150
          ? data.username.trim()
          : "";
      let ownsPreviousUrl = false;
      let previousUrlWasOwned = false;
      const usernameRef = adminDb
        .collection("usernames")
        .doc(username.toLowerCase());
      const requestedAliasRef = adminDb
        .collection("usernameAliases")
        .doc(username.toLowerCase());
      const [usernameDoc, requestedAliasDoc, existingUsers] = await Promise.all(
        [
          transaction.get(usernameRef),
          transaction.get(requestedAliasRef),
          transaction.get(
            adminDb
              .collection("users")
              .where("username", "==", username)
              .limit(1),
          ),
        ],
      );
      if (
        usernameDoc.exists ||
        requestedAliasDoc.exists ||
        !existingUsers.empty
      ) {
        throw new Error("USERNAME_TAKEN");
      }
      const updateData: Record<string, unknown> = {
        username,
        usernameConfirmed: true,
        usernameRotatedAt: FieldValue.serverTimestamp(),
        usernameRotatedBy: verification.uid,
        usernameRotatedBySelf: true,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (previousUsername) {
        updateData.previousUsernames = FieldValue.arrayUnion(previousUsername);
        const previousRef = adminDb
          .collection("usernames")
          .doc(String(previousUsername).toLowerCase());
        const previousDoc = await transaction.get(previousRef);
        const previousAliasRef = adminDb
          .collection("usernameAliases")
          .doc(String(previousUsername).toLowerCase());
        const previousAliasDoc = await transaction.get(previousAliasRef);
        if (
          previousDoc.exists &&
          previousDoc.data()?.uid === verification.uid &&
          previousAliasDoc.exists &&
          previousAliasDoc.data()?.uid !== verification.uid
        ) {
          throw new Error("LEGACY_ALIAS_CONFLICT");
        }
        const hasPreviousOwnershipRecord =
          (previousDoc.exists &&
            previousDoc.data()?.uid === verification.uid) ||
          (previousAliasDoc.exists &&
            previousAliasDoc.data()?.uid === verification.uid) ||
          previousUsername === `u_${verification.uid}`;
        const publicOwner = await resolvePublicProfileOwner(previousUsername);
        ownsPreviousUrl =
          hasPreviousOwnershipRecord && publicOwner === verification.uid;
        const needsQuarantine =
          !hasPreviousOwnershipRecord && publicOwner === verification.uid;
        previousUrlWasOwned = ownsPreviousUrl || needsQuarantine;
        if (
          legacyUrlAction === "redirect" &&
          (!ownsPreviousUrl ||
            (previousDoc.exists &&
              previousDoc.data()?.uid !== verification.uid) ||
            (previousAliasDoc.exists &&
              previousAliasDoc.data()?.uid !== verification.uid))
        ) {
          throw new Error("LEGACY_ALIAS_CONFLICT");
        }
        if (
          previousDoc.exists &&
          previousDoc.data()?.uid === verification.uid
        ) {
          transaction.delete(previousRef);
        }

        if (legacyUrlAction === "redirect") {
          transaction.set(previousAliasRef, {
            uid: verification.uid,
            username: previousUsername,
            targetUsername: username,
            status: "redirect",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
        } else if (
          (ownsPreviousUrl || needsQuarantine) &&
          (!previousDoc.exists ||
            previousDoc.data()?.uid === verification.uid) &&
          (!previousAliasDoc.exists ||
            previousAliasDoc.data()?.uid === verification.uid)
        ) {
          transaction.set(previousAliasRef, {
            uid: ownsPreviousUrl ? verification.uid : null,
            username: previousUsername,
            status: "disabled",
            ...(needsQuarantine ? { quarantined: true } : {}),
            updatedAt: FieldValue.serverTimestamp(),
            createdAt:
              previousAliasDoc.data()?.createdAt ||
              FieldValue.serverTimestamp(),
          });
        }
      }

      transaction.set(usernameRef, {
        uid: verification.uid,
        username,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(userRef, updateData);

      return {
        previousUsername,
        username,
        previousUrlWasOwned,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      previousUsername: result.previousUsername,
      username: result.username,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["USERNAME_TAKEN", "LEGACY_ALIAS_CONFLICT"].includes(error.message)
    ) {
      return NextResponse.json({ error: "username_taken" }, { status: 409 });
    }
    console.error("Self-service username rotation failed:", error);
    return NextResponse.json(
      { error: "Failed to rotate username" },
      { status: 500 },
    );
  }
}
