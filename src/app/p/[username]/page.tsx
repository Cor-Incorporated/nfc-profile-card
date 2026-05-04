import { ProfileAnalyticsTracker } from "@/components/profile/ProfileAnalyticsTracker";
import { ProfileFloatingActions } from "@/components/profile/ProfileFloatingActions";
import { SimpleRenderer } from "@/components/profile/SimpleRenderer";
import { TraditionalProfile } from "@/components/profile/TraditionalProfile";
import { adminDb } from "@/lib/firebase-admin";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  FieldPath,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { cache } from "react";

export const revalidate = 300;

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

interface ProfilePageProps {
  params: { username: string };
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

type UserProfileDoc = QueryDocumentSnapshot<DocumentData>;

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
  const snapshot = await adminDb
    .collection("users")
    .where(FieldPath.documentId(), "==", uid)
    .select(...PUBLIC_USER_FIELDS)
    .limit(1)
    .get();

  return snapshot.docs[0];
}

async function fetchUserByUsername(
  username: string,
): Promise<UserProfileDoc | undefined> {
  const snapshot = await adminDb
    .collection("users")
    .where("username", "==", username)
    .select(...PUBLIC_USER_FIELDS)
    .limit(1)
    .get();

  return snapshot.docs[0];
}

async function resolveUserDoc(
  username: string,
): Promise<UserProfileDoc | null> {
  const normalizedUsername = normalizeUsername(username);
  const usernameDoc = await adminDb
    .collection("usernames")
    .doc(normalizedUsername)
    .get();
  const reservedUid = usernameDoc.exists ? usernameDoc.data()?.uid : null;

  if (typeof reservedUid === "string" && reservedUid) {
    const reservedUserDoc = await fetchUserByUid(reservedUid);
    if (reservedUserDoc) return reservedUserDoc;
  }

  const normalizedUserDoc = await fetchUserByUsername(normalizedUsername);
  if (normalizedUserDoc) return normalizedUserDoc;

  if (username !== normalizedUsername) {
    const exactUserDoc = await fetchUserByUsername(username);
    if (exactUserDoc) return exactUserDoc;
  }

  if (username.startsWith("u_")) {
    const uidUserDoc = await fetchUserByUid(username.slice(2));
    if (uidUserDoc) return uidUserDoc;
  }

  return null;
}

async function fetchProfileData(userId: string) {
  const snapshot = await adminDb
    .collection("users")
    .doc(userId)
    .collection("profile")
    .where(FieldPath.documentId(), "==", "data")
    .select("components", "background")
    .limit(1)
    .get();

  return snapshot.docs[0]?.data() || null;
}

const fetchUserData = cache(async (username: string) => {
  try {
    const userDoc = await resolveUserDoc(username);

    if (!userDoc) {
      return { user: null, profileData: null };
    }

    const userData = toPublicUserProfile(userDoc.data());
    const userId = userDoc.id;

    let profileData = null;
    try {
      profileData = await fetchProfileData(userId);
    } catch (error) {
      console.error(
        "Failed to read profile subdocument for username:",
        username,
        error,
      );
    }

    return { user: userData, profileData };
  } catch (error) {
    console.error("Failed to fetch user data for username:", username, error);
    throw error;
  }
});

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { user } = await fetchUserData(params.username);

  if (!user) {
    return {
      title: "Profile Not Found",
    };
  }

  return {
    title: `${user.name} - TapForge`,
    description:
      user.bio ||
      `${user.name}${user.company ? ` | ${user.company}` : ""}${user.position ? ` - ${user.position}` : ""}`,
    openGraph: {
      title: user.name,
      description: user.bio || undefined,
      images: user.photoURL ? [{ url: user.photoURL }] : undefined,
    },
  };
}

function Footer() {
  return (
    <footer className="w-full py-6 mt-12 border-t border-gray-200 bg-white/50 backdrop-blur">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm text-gray-600">
          <Link
            href="https://tapforge.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            TapForge
          </Link>
          {" powered by "}
          <Link
            href="https://cor-jp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            Cor.Inc.
          </Link>
        </p>
      </div>
    </footer>
  );
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { user, profileData } = await fetchUserData(params.username);

  if (!user) {
    notFound();
  }

  const nameParts = user.name?.split(" ") || [];
  const vcardFirstName = nameParts[0] || "";
  const vcardLastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const vcardData = {
    firstName: vcardFirstName,
    lastName: vcardLastName,
    organization: user.company || "",
    title: user.position || "",
    email: user.email || "",
    workPhone: user.phone || "",
    url: user.website || "",
    workAddress: user.address ? { street: user.address } : undefined,
  };

  if (profileData?.components && Array.isArray(profileData.components)) {
    return (
      <>
        <SimpleRenderer
          components={profileData.components}
          background={profileData.background}
        />
        <ProfileFloatingActions
          username={params.username}
          photoURL={user.photoURL}
          variant="full"
        />
        <ProfileAnalyticsTracker username={params.username} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <TraditionalProfile
        user={user}
        vcardData={vcardData}
        username={params.username}
      />
      <ProfileFloatingActions
        username={params.username}
        photoURL={user.photoURL}
        variant="minimal"
      />
      <ProfileAnalyticsTracker username={params.username} />
      <Footer />
    </>
  );
}
