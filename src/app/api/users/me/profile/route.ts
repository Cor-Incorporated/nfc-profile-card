import { BIO_MAX_LENGTH } from "@/lib/constants/profile";
import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { syncBasicProfileContent } from "@/lib/profile/syncBasicProfile";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
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

function getExactUidUsername(uid: string) {
  const fallback = getUidFallbackUsername(uid);
  return fallback === `u_${uid}` ? fallback : "";
}

function isValidUsername(username: string, uid?: string) {
  const ownUidUsername = uid ? getExactUidUsername(uid) : "";
  const isOwnUidUsername = Boolean(
    ownUidUsername && username === ownUidUsername,
  );
  return (
    (USERNAME_PATTERN.test(username) || isOwnUidUsername) &&
    (!isReservedUsername(username) || isOwnUidUsername)
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
  if (usernameKey.startsWith("u_")) {
    const directUidDoc = await adminDb
      .collection("users")
      .doc(usernameKey.slice(2))
      .get();
    if (directUidDoc.exists && directUidDoc.id !== uid) return false;
  }
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
  if (alias.exists && alias.data()?.uid !== uid) {
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
          ? getExactUidUsername(verification.uid)
          : normalizeUsername(body.username);

    if (!requestedUsername) {
      return NextResponse.json(
        {
          error:
            usernameMode === "uid" ? "username_invalid" : "username_required",
        },
        { status: 400 },
      );
    }

    const userRef = adminDb.collection("users").doc(verification.uid);
    const userDoc = await userRef.get();
    const currentUsernameRaw =
      typeof userDoc.data()?.username === "string"
        ? userDoc.data()?.username
        : "";
    const expectedUsernameRaw =
      typeof body.expectedUsername === "string"
        ? body.expectedUsername
        : currentUsernameRaw;
    const isUsernameChanging =
      usernameMode === "uid"
        ? requestedUsername !== expectedUsernameRaw
        : normalizeUsername(requestedUsername) !==
          normalizeUsername(expectedUsernameRaw);

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

    const baseProfileUpdates: Record<string, unknown> = {
      uid: verification.uid,
      usernameConfirmed: true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    for (const field of PROFILE_STRING_FIELDS) {
      baseProfileUpdates[field] = pickString(
        body[field],
        field === "bio" ? BIO_MAX_LENGTH : 200,
      );
    }

    const profileDocRef = userRef.collection("profile").doc("data");
    const saved = await adminDb.runTransaction(async (transaction) => {
      const latestUserDoc = await transaction.get(userRef);
      const profileDoc = await transaction.get(profileDocRef);
      const latestUsernameRaw =
        typeof latestUserDoc.data()?.username === "string"
          ? latestUserDoc.data()?.username
          : "";
      const latestUsername = normalizeUsername(latestUsernameRaw);
      // A basic-field save from a stale editor must preserve a concurrent
      // username rotation. An explicit rename must retry after the caller
      // sees the new username instead of overwriting its reservation.
      if (isUsernameChanging && latestUsernameRaw !== expectedUsernameRaw) {
        throw new Error("USERNAME_STALE");
      }
      // A supplied expectedUsername only describes the editor's old state.
      // It cannot bypass reservation checks when the stored name is empty.
      const changingUsername =
        isUsernameChanging || (!latestUsernameRaw && !!requestedUsername);
      if (
        changingUsername &&
        !isValidUsername(requestedUsername, verification.uid)
      ) {
        throw new Error("USERNAME_INVALID");
      }
      const profileUpdates: Record<string, unknown> = {
        ...baseProfileUpdates,
        username: changingUsername
          ? requestedUsername
          : latestUsernameRaw || requestedUsername,
      };
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

      if (!changingUsername) {
        saveUserAndProfile();
        return {
          profileUpdates,
          previousUsername: "",
          previousUrlWasOwned: false,
        };
      }

      const usernameRef = adminDb
        .collection("usernames")
        .doc(requestedUsername.toLowerCase());
      const usernameDoc = await transaction.get(usernameRef);
      if (usernameDoc.exists && usernameDoc.data()?.uid !== verification.uid) {
        throw new Error("USERNAME_TAKEN");
      }

      if (requestedUsername.startsWith("u_")) {
        const directUidRef = adminDb
          .collection("users")
          .doc(requestedUsername.toLowerCase().slice(2));
        const directUidDoc = await transaction.get(directUidRef);
        if (directUidDoc.exists && directUidDoc.id !== verification.uid) {
          throw new Error("USERNAME_TAKEN");
        }
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

      const requestedAliasRef = adminDb
        .collection("usernameAliases")
        .doc(requestedUsername.toLowerCase());
      const requestedAliasDoc = await transaction.get(requestedAliasRef);
      if (
        requestedAliasDoc.exists &&
        requestedAliasDoc.data()?.uid !== verification.uid
      ) {
        throw new Error("USERNAME_TAKEN");
      }

      const previousUsername = latestUsername;
      const previousUsernameRaw = latestUsernameRaw;
      let previousUrlWasOwned = false;
      if (
        previousUsername &&
        !previousUsername.includes("/") &&
        previousUsername.length <= 150 &&
        previousUsername !== normalizeUsername(requestedUsername)
      ) {
        const previousRef = adminDb
          .collection("usernames")
          .doc(previousUsername.toLowerCase());
        const previousDoc = await transaction.get(previousRef);
        const previousAliasRef = adminDb
          .collection("usernameAliases")
          .doc(previousUsername.toLowerCase());
        const previousAliasDoc = await transaction.get(previousAliasRef);
        if (
          previousDoc.exists &&
          previousDoc.data()?.uid === verification.uid &&
          previousAliasDoc.exists &&
          previousAliasDoc.data()?.uid !== verification.uid
        ) {
          throw new Error("USERNAME_TAKEN");
        }
        const hasPreviousOwnershipRecord =
          (previousDoc.exists &&
            previousDoc.data()?.uid === verification.uid) ||
          (previousAliasDoc.exists &&
            previousAliasDoc.data()?.uid === verification.uid) ||
          previousUsernameRaw === `u_${verification.uid}`;
        const publicOwner =
          await resolvePublicProfileOwner(previousUsernameRaw);
        const ownsPreviousUrl =
          hasPreviousOwnershipRecord && publicOwner === verification.uid;
        const needsQuarantine =
          !hasPreviousOwnershipRecord && publicOwner === verification.uid;
        previousUrlWasOwned = ownsPreviousUrl || needsQuarantine;
        if (
          legacyUrlAction === "redirect" &&
          (!ownsPreviousUrl ||
            (previousAliasDoc.exists &&
              previousAliasDoc.data()?.uid !== verification.uid))
        ) {
          throw new Error("USERNAME_TAKEN");
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
            targetUsername: requestedUsername,
            status: "redirect",
            updatedAt: FieldValue.serverTimestamp(),
            createdAt:
              previousAliasDoc.data()?.createdAt ||
              FieldValue.serverTimestamp(),
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

        profileUpdates.previousUsernames =
          FieldValue.arrayUnion(previousUsername);
      }

      transaction.delete(requestedAliasRef);

      transaction.set(usernameRef, {
        uid: verification.uid,
        username: requestedUsername,
        updatedAt: FieldValue.serverTimestamp(),
      });
      saveUserAndProfile();
      return {
        profileUpdates,
        previousUsername: previousUsernameRaw,
        previousUrlWasOwned,
      };
    });

    return NextResponse.json({
      profile: {
        ...Object.fromEntries(
          PROFILE_STRING_FIELDS.map((field) => [
            field,
            saved.profileUpdates[field],
          ]),
        ),
        username: saved.profileUpdates.username,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "USERNAME_STALE") {
      return NextResponse.json({ error: "username_stale" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "USERNAME_INVALID") {
      return NextResponse.json({ error: "username_invalid" }, { status: 400 });
    }
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
