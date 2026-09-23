import { adminDb } from "@/lib/firebase-admin";
import {
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

interface UserProfile {
  name: string;
  username: string;
  bio: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  photoURL?: string;
  links: Array<{
    id: string;
    title: string;
    url: string;
    service?: string;
  }>;
}

const PUBLIC_USER_FIELDS = [
  "name",
  "username",
  "bio",
  "company",
  "position",
  "email",
  "phone",
  "website",
  "address",
  "photoURL",
  "links",
] as const;

type UserProfileDoc = DocumentSnapshot<DocumentData>;

interface ResolvedUserDoc {
  userDoc: UserProfileDoc;
  profileData?: DocumentData | null;
  redirectUsername?: string;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function toPublicUserProfile(data: DocumentData): UserProfile {
  return {
    name: typeof data.name === "string" ? data.name : "",
    username: typeof data.username === "string" ? data.username : "",
    bio: typeof data.bio === "string" ? data.bio : "",
    company: typeof data.company === "string" ? data.company : "",
    position: typeof data.position === "string" ? data.position : "",
    email: typeof data.email === "string" ? data.email : "",
    phone: typeof data.phone === "string" ? data.phone : "",
    website: typeof data.website === "string" ? data.website : "",
    address: typeof data.address === "string" ? data.address : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : undefined,
    links: Array.isArray(data.links) ? data.links : [],
  };
}

async function fetchUserByUid(
  uid: string,
): Promise<UserProfileDoc | undefined> {
  const userRef = adminDb.collection("users").doc(uid);
  const [userDoc] = await adminDb.getAll(userRef, {
    fieldMask: [...PUBLIC_USER_FIELDS],
  });
  return userDoc.exists ? userDoc : undefined;
}

async function fetchUserByUsername(
  username: string,
): Promise<QueryDocumentSnapshot<DocumentData> | null | undefined> {
  const snapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .select(...PUBLIC_USER_FIELDS)
    .limit(2)
    .get();

  if (snapshot.docs.length > 1) return null;
  return snapshot.docs[0];
}

async function fetchProfileData(userId: string): Promise<DocumentData | null> {
  const profileRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("profile")
    .doc("data");
  const [profileDoc] = await adminDb.getAll(profileRef, {
    fieldMask: ["components", "background"],
  });
  return profileDoc.data() || null;
}

async function fetchProfileDataOrNull(userId: string) {
  try {
    return await fetchProfileData(userId);
  } catch (error) {
    // The basic profile can still render if its optional design document fails.
    console.error("Failed to read profile subdocument:", error);
    return null;
  }
}

async function fetchUserAndProfileByUid(
  uid: string,
  loadProfile: boolean,
): Promise<ResolvedUserDoc | null> {
  if (!loadProfile) {
    const userDoc = await fetchUserByUid(uid);
    return userDoc ? { userDoc } : null;
  }

  // Start both independent reads together once we have a trusted UID.
  const [userDoc, profileData] = await Promise.all([
    fetchUserByUid(uid),
    fetchProfileDataOrNull(uid),
  ]);
  return userDoc ? { userDoc, profileData } : null;
}

async function verifiedAliasTarget(
  uid: string,
  requestedUsername: string,
  aliasData: DocumentData,
  userDoc: UserProfileDoc,
) {
  // Existing user fields may be stale. Redirect only to a reservation owned
  // by this UID or to the exact UID's fixed URL.
  for (const value of [userDoc.data()?.username, aliasData.targetUsername]) {
    if (typeof value !== "string") continue;
    const rawTarget = value.trim();
    const target = normalizeUsername(value);
    if (
      target === requestedUsername ||
      !target ||
      target.includes("/") ||
      target.length > 150
    ) {
      continue;
    }
    const reservation = await adminDb.collection("usernames").doc(target).get();
    // An exact UID URL is also owned without a reservation. Preserve its
    // original case and symbols so the redirect reaches that UID document.
    if (rawTarget === `u_${uid}`) {
      if (!reservation.exists || reservation.data()?.uid === uid) {
        return rawTarget;
      }
      continue;
    }
    if (!/^[a-z0-9_-]{3,150}$/.test(target)) continue;
    if (!reservation.exists || reservation.data()?.uid !== uid) continue;
    // The exact-case UID path above is the only safe u_ target. A normalized
    // variant may have belonged to a different UID that was later deleted.
    if (target.startsWith("u_")) continue;
    return target;
  }
  return undefined;
}

async function resolveUserDoc(
  username: string,
  loadProfile = false,
): Promise<ResolvedUserDoc | null> {
  const normalizedUsername = normalizeUsername(username);
  if (
    username !== username.trim() ||
    !normalizedUsername ||
    normalizedUsername.includes("/") ||
    normalizedUsername.length > 150
  ) {
    return null;
  }

  // A UID fallback path belongs to its document ID even if another user's
  // editable username field or a stale reservation contains the same text.
  if (normalizedUsername.startsWith("u_")) {
    const [fallback, fallbackAlias, fallbackReservation] = await Promise.all([
      fetchUserAndProfileByUid(username.slice(2), loadProfile),
      adminDb.collection("usernameAliases").doc(normalizedUsername).get(),
      adminDb.collection("usernames").doc(normalizedUsername).get(),
    ]);
    const reservationUid = fallbackReservation.exists
      ? fallbackReservation.data()?.uid
      : null;
    if (fallback) {
      if (
        fallbackReservation.exists &&
        reservationUid !== fallback.userDoc.id
      ) {
        return null;
      }
      const alias = fallbackAlias.exists ? fallbackAlias.data() : null;
      if (typeof alias?.uid === "string" && alias.uid !== fallback.userDoc.id) {
        return null;
      }
      if (alias?.status === "redirect" && alias.uid === fallback.userDoc.id) {
        const redirectUsername = await verifiedAliasTarget(
          fallback.userDoc.id,
          normalizedUsername,
          alias,
          fallback.userDoc,
        );
        if (redirectUsername) {
          return { userDoc: fallback.userDoc, redirectUsername };
        }
      }
      return fallback;
    }
    // A deleted UID's fixed URL must never be inherited by a different UID.
    // Case-folded reservations and aliases cannot prove that the exact UID
    // named by this path never existed, so only an exact UID match is safe.
    if (reservationUid !== username.slice(2)) return null;
    return fetchUserAndProfileByUid(reservationUid, loadProfile);
  }

  const usernameDoc = await adminDb
    .collection("usernames")
    .doc(normalizedUsername)
    .get();
  const reservedUid = usernameDoc.exists ? usernameDoc.data()?.uid : null;

  if (usernameDoc.exists) {
    if (typeof reservedUid !== "string" || !reservedUid) return null;
    if (username !== normalizedUsername) {
      // A newer lowercase reservation must not silently replace an older
      // exact mixed-case legacy URL owned by someone else.
      const exactLegacyOwner = await fetchUserByUsername(username);
      if (
        exactLegacyOwner === null ||
        (exactLegacyOwner && exactLegacyOwner.id !== reservedUid)
      ) {
        return null;
      }
    }
    return fetchUserAndProfileByUid(reservedUid, loadProfile);
  }

  const aliasDoc = await adminDb
    .collection("usernameAliases")
    .doc(normalizedUsername)
    .get();
  const aliasData = aliasDoc.exists ? aliasDoc.data() : null;
  if (aliasDoc.exists) {
    const aliasUid = aliasData?.status === "redirect" ? aliasData?.uid : null;
    if (typeof aliasUid !== "string" || !aliasUid) return null;
    if (username !== normalizedUsername) {
      const exactLegacyOwner = await fetchUserByUsername(username);
      if (
        exactLegacyOwner === null ||
        (exactLegacyOwner && exactLegacyOwner.id !== aliasUid)
      ) {
        return null;
      }
    }
    const aliasUserDoc = await fetchUserByUid(aliasUid);
    if (aliasUserDoc) {
      const redirectUsername = await verifiedAliasTarget(
        aliasUid,
        normalizedUsername,
        aliasData || {},
        aliasUserDoc,
      );
      if (!redirectUsername) return null;
      return {
        userDoc: aliasUserDoc,
        redirectUsername,
      };
    }
    return null;
  }

  const normalizedUserDoc = await fetchUserByUsername(normalizedUsername);
  if (normalizedUserDoc === null) return null;
  const exactUserDoc =
    username !== normalizedUsername
      ? await fetchUserByUsername(username)
      : undefined;
  if (exactUserDoc === null) return null;
  if (username !== normalizedUsername && normalizedUserDoc && !exactUserDoc) {
    // An unreserved mixed-case URL must not silently select another user's
    // lowercase field when no exact legacy owner exists.
    return null;
  }
  if (
    normalizedUserDoc &&
    exactUserDoc &&
    normalizedUserDoc.id !== exactUserDoc.id
  ) {
    return null;
  }
  const legacyUserDoc = normalizedUserDoc || exactUserDoc;
  if (legacyUserDoc) return { userDoc: legacyUserDoc };

  return null;
}

export async function resolvePublicProfileOwner(username: string) {
  const resolved = await resolveUserDoc(username);
  return resolved?.userDoc.id || null;
}

export async function fetchPublicProfileByUsername(username: string) {
  try {
    const resolved = await resolveUserDoc(username, true);
    if (!resolved) {
      return { user: null, profileData: null, redirectUsername: null };
    }

    const { userDoc, redirectUsername } = resolved;
    const user = toPublicUserProfile(userDoc.data() || {});
    const profileData = redirectUsername
      ? null
      : resolved.profileData !== undefined
        ? resolved.profileData
        : await fetchProfileDataOrNull(userDoc.id);

    return { user, profileData, redirectUsername: redirectUsername || null };
  } catch (error) {
    console.error("Failed to fetch user data for username:", username, error);
    throw error;
  }
}
