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
): Promise<QueryDocumentSnapshot<DocumentData> | undefined> {
  const snapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .select(...PUBLIC_USER_FIELDS)
    .limit(1)
    .get();

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
): Promise<ResolvedUserDoc | null> {
  // Start both independent reads together once the reservation gives us a UID.
  const [userDoc, profileData] = await Promise.all([
    fetchUserByUid(uid),
    fetchProfileDataOrNull(uid),
  ]);
  return userDoc ? { userDoc, profileData } : null;
}

async function resolveUserDoc(
  username: string,
): Promise<ResolvedUserDoc | null> {
  const normalizedUsername = normalizeUsername(username);
  const usernameDoc = await adminDb
    .collection("usernames")
    .doc(normalizedUsername)
    .get();
  const reservedUid = usernameDoc.exists ? usernameDoc.data()?.uid : null;

  if (typeof reservedUid === "string" && reservedUid) {
    const reserved = await fetchUserAndProfileByUid(reservedUid);
    if (reserved) return reserved;
  }

  const normalizedUserDoc = await fetchUserByUsername(normalizedUsername);
  if (normalizedUserDoc) return { userDoc: normalizedUserDoc };

  if (username !== normalizedUsername) {
    const exactUserDoc = await fetchUserByUsername(username);
    if (exactUserDoc) return { userDoc: exactUserDoc };
  }

  const aliasDoc = await adminDb
    .collection("usernameAliases")
    .doc(normalizedUsername)
    .get();
  const aliasData = aliasDoc.exists ? aliasDoc.data() : null;
  const aliasUid = aliasData?.status === "redirect" ? aliasData?.uid : null;
  if (typeof aliasUid === "string" && aliasUid) {
    const aliasUserDoc = await fetchUserByUid(aliasUid);
    if (aliasUserDoc) {
      const currentUsername = normalizeUsername(
        aliasUserDoc.data()?.username || "",
      );
      return {
        userDoc: aliasUserDoc,
        redirectUsername:
          currentUsername && currentUsername !== normalizedUsername
            ? currentUsername
            : undefined,
      };
    }
  }

  if (username.startsWith("u_")) {
    const uidUserDoc = await fetchUserAndProfileByUid(username.slice(2));
    if (uidUserDoc) return uidUserDoc;
  }

  return null;
}

export async function fetchPublicProfileByUsername(username: string) {
  try {
    const resolved = await resolveUserDoc(username);
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
