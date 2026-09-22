import { BIO_MAX_LENGTH } from "@/lib/constants/profile";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import {
  getOwnedUidFallbackUsername,
  revalidatePublicProfiles,
} from "@/lib/profile/revalidatePublicProfiles";
import { getOwnedRedirectAliases } from "@/lib/profile/getOwnedRedirectAliases";
import { ownsPublicUsername } from "@/lib/profile/ownsPublicUsername";
import { syncBasicProfileContent } from "@/lib/profile/syncBasicProfile";
import {
  generateDefaultUsername,
  getUidFallbackUsername,
} from "@/lib/username";
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
  "photoURL",
] as const;

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isReservedUsername(username: string) {
  return username.startsWith("u_");
}

function isValidUsername(username: string, uid?: string) {
  const ownUidUsername = uid ? getUidFallbackUsername(uid).toLowerCase() : "";
  return (
    USERNAME_PATTERN.test(username) &&
    (!isReservedUsername(username) || username === ownUidUsername)
  );
}

function pickString(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function normalizeLegacyUrlAction(value: unknown) {
  return value === "redirect" ? "redirect" : "disable";
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

  const alias = await adminDb
    .collection("usernameAliases")
    .doc(usernameKey)
    .get();
  if (
    alias.exists &&
    alias.data()?.status === "redirect" &&
    alias.data()?.uid !== uid
  ) {
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
      isValidUsername(candidate, uid) &&
      (await isUsernameAvailable(candidate, uid))
    ) {
      available.push(candidate);
    }
    if (available.length >= 3) break;
  }

  return available;
}

async function generateUniqueUsername(uid: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = generateDefaultUsername();
    if (await isUsernameAvailable(username, uid)) {
      return username;
    }
  }

  throw new Error("Failed to generate unique username");
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
    const legacyUrlAction = normalizeLegacyUrlAction(body.legacyUrlAction);
    const usernameMode =
      typeof body.usernameMode === "string" ? body.usernameMode : "custom";
    const requestedUsername =
      usernameMode === "random"
        ? await generateUniqueUsername(verification.uid)
        : usernameMode === "uid"
          ? getUidFallbackUsername(verification.uid).toLowerCase()
          : normalizeUsername(body.username);

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
    const currentUsernameOwned = currentUsernameRaw
      ? await ownsPublicUsername(verification.uid, currentUsernameRaw)
      : false;

    if (
      isUsernameChanging &&
      !isValidUsername(requestedUsername, verification.uid)
    ) {
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
      usernameConfirmed: true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    for (const field of PROFILE_STRING_FIELDS) {
      profileUpdates[field] = pickString(
        body[field],
        field === "bio" ? BIO_MAX_LENGTH : 200,
      );
    }

    const ownedAliases = isUsernameChanging
      ? await getOwnedRedirectAliases(verification.uid)
      : [];
    const profileDocRef = userRef.collection("profile").doc("data");
    await adminDb.runTransaction(async (transaction) => {
      const latestUserDoc = await transaction.get(userRef);
      const profileDoc = await transaction.get(profileDocRef);
      const userExists = latestUserDoc.exists;
      const saveUserAndProfile = () => {
        transaction.set(
          userRef,
          {
            ...profileUpdates,
            ...(!userExists ? { createdAt: FieldValue.serverTimestamp() } : {}),
          },
          { merge: true },
        );

        const profileData = profileDoc.exists ? profileDoc.data() : null;
        if (Array.isArray(profileData?.components)) {
          const components: any[] = profileData.components;
          const updatedComponents = components.map((comp: any) => {
            if (comp.type !== "profile") return comp;
            return {
              ...comp,
              content: syncBasicProfileContent(
                comp.content || {},
                profileUpdates,
                body.replaceComponentAddress === true,
              ),
            };
          });
          transaction.update(profileDocRef, {
            components: updatedComponents,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      };

      if (!isUsernameChanging) {
        saveUserAndProfile();
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

        const previousAliasRef = adminDb
          .collection("usernameAliases")
          .doc(previousUsername.toLowerCase());
        if (legacyUrlAction === "redirect") {
          transaction.set(previousAliasRef, {
            uid: verification.uid,
            username: previousUsername,
            targetUsername: requestedUsername,
            status: "redirect",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
          });
        } else {
          transaction.delete(previousAliasRef);
        }

        profileUpdates.previousUsernames =
          FieldValue.arrayUnion(previousUsername);
      }

      const requestedAliasRef = adminDb
        .collection("usernameAliases")
        .doc(requestedUsername.toLowerCase());
      transaction.delete(requestedAliasRef);

      transaction.set(usernameRef, {
        uid: verification.uid,
        username: requestedUsername,
        updatedAt: FieldValue.serverTimestamp(),
      });
      saveUserAndProfile();
    });

    revalidatePublicProfiles(
      currentUsernameOwned ? currentUsernameRaw : null,
      currentUsernameOwned || isUsernameChanging ? requestedUsername : null,
      getOwnedUidFallbackUsername(verification.uid),
      ...ownedAliases,
    );

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

// The design editor writes its document through the Firebase client SDK. It
// calls this authenticated endpoint only after Firestore confirms that write.
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

    const userDoc = await adminDb
      .collection("users")
      .doc(verification.uid)
      .get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      !(await ownsPublicUsername(verification.uid, userDoc.data()?.username))
    ) {
      return NextResponse.json(
        { error: "public_username_not_owned" },
        { status: 403 },
      );
    }

    revalidatePublicProfiles(
      userDoc.data()?.username,
      getOwnedUidFallbackUsername(verification.uid),
    );
    return NextResponse.json({ revalidated: true });
  } catch (error) {
    console.error("Public profile revalidation failed:", error);
    return NextResponse.json(
      { error: "profile_revalidation_failed" },
      { status: 500 },
    );
  }
}
