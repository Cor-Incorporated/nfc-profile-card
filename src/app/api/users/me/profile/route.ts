import { BIO_MAX_LENGTH } from "@/lib/constants/profile";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_-]{2,31}$/;

const PROFILE_STRING_FIELDS = [
  "name",
  "bio",
  "company",
  "position",
  "email",
  "phone",
  "website",
  "address",
] as const;

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isReservedUsername(username: string) {
  return username.startsWith("u_");
}

function isValidUsername(username: string) {
  return USERNAME_PATTERN.test(username) && !isReservedUsername(username);
}

function pickString(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

async function isUsernameAvailable(username: string, uid: string) {
  const usernameKey = username.toLowerCase();
  const reservation = await adminDb
    .collection("usernames")
    .doc(usernameKey)
    .get();
  if (reservation.exists && reservation.data()?.uid !== uid) {
    return false;
  }

  const snapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(1)
    .get();

  return snapshot.empty || snapshot.docs[0].id === uid;
}

async function buildUsernameSuggestions(username: string, uid: string) {
  const base = username.replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "user";
  const candidates = new Set<string>();

  while (candidates.size < 8) {
    const suffix = Math.floor(100 + Math.random() * 9000);
    candidates.add(`${base}${suffix}`.slice(0, 32));
  }

  const available: string[] = [];
  for (const candidate of candidates) {
    if (
      isValidUsername(candidate) &&
      (await isUsernameAvailable(candidate, uid))
    ) {
      available.push(candidate);
    }
    if (available.length >= 3) break;
  }

  return available;
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const requestedUsername = normalizeUsername(body.username);
    if (!requestedUsername) {
      return NextResponse.json({ error: "username_required" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(verification.uid);
    const userDoc = await userRef.get();
    const currentUsernameRaw =
      typeof userDoc.data()?.username === "string"
        ? userDoc.data()?.username
        : "";
    const currentUsername = normalizeUsername(currentUsernameRaw);
    const isUsernameChanging = requestedUsername !== currentUsername;

    if (isUsernameChanging && !isValidUsername(requestedUsername)) {
      return NextResponse.json({ error: "username_invalid" }, { status: 400 });
    }

    if (
      isUsernameChanging &&
      !(await isUsernameAvailable(requestedUsername, verification.uid))
    ) {
      const suggestions = await buildUsernameSuggestions(
        requestedUsername,
        verification.uid,
      );
      return NextResponse.json(
        { error: "username_taken", suggestions },
        { status: 409 },
      );
    }

    const profileUpdates: Record<string, unknown> = {
      uid: verification.uid,
      username: isUsernameChanging
        ? requestedUsername
        : currentUsernameRaw || requestedUsername,
      updatedAt: FieldValue.serverTimestamp(),
    };

    for (const field of PROFILE_STRING_FIELDS) {
      profileUpdates[field] = pickString(
        body[field],
        field === "bio" ? BIO_MAX_LENGTH : 200,
      );
    }

    await adminDb.runTransaction(async (transaction) => {
      const latestUserDoc = await transaction.get(userRef);
      const userExists = latestUserDoc.exists;

      if (!isUsernameChanging) {
        transaction.set(
          userRef,
          {
            ...profileUpdates,
            ...(!userExists ? { createdAt: FieldValue.serverTimestamp() } : {}),
          },
          { merge: true },
        );
        return;
      }

      const usernameRef = adminDb
        .collection("usernames")
        .doc(requestedUsername.toLowerCase());
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists && usernameDoc.data()?.uid !== verification.uid) {
        throw new Error("USERNAME_TAKEN");
      }

      const exactUsernameSnapshot = await transaction.get(
        adminDb
          .collection("users")
          .where("username", "==", requestedUsername)
          .limit(1),
      );
      if (
        !exactUsernameSnapshot.empty &&
        exactUsernameSnapshot.docs[0].id !== verification.uid
      ) {
        throw new Error("USERNAME_TAKEN");
      }

      const previousUsername = normalizeUsername(
        latestUserDoc.data()?.username,
      );
      if (previousUsername && previousUsername !== requestedUsername) {
        const previousRef = adminDb
          .collection("usernames")
          .doc(previousUsername.toLowerCase());
        const previousDoc = await transaction.get(previousRef);
        if (
          previousDoc.exists &&
          previousDoc.data()?.uid === verification.uid
        ) {
          transaction.delete(previousRef);
        }
        profileUpdates.previousUsernames =
          FieldValue.arrayUnion(previousUsername);
      }

      transaction.set(usernameRef, {
        uid: verification.uid,
        username: requestedUsername,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(
        userRef,
        {
          ...profileUpdates,
          ...(!userExists ? { createdAt: FieldValue.serverTimestamp() } : {}),
        },
        { merge: true },
      );
    });

    return NextResponse.json({
      profile: {
        ...Object.fromEntries(
          PROFILE_STRING_FIELDS.map((field) => [field, profileUpdates[field]]),
        ),
        username: profileUpdates.username,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_TAKEN") {
      return NextResponse.json(
        { error: "username_taken", suggestions: [] },
        { status: 409 },
      );
    }

    console.error("Profile update failed:", error);
    return NextResponse.json(
      { error: "profile_update_failed" },
      { status: 500 },
    );
  }
}
