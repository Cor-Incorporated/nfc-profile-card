import { ProfileAnalyticsTracker } from "@/components/profile/ProfileAnalyticsTracker";
import { ProfileFloatingActions } from "@/components/profile/ProfileFloatingActions";
import { SimpleRenderer } from "@/components/profile/SimpleRenderer";
import { TraditionalProfile } from "@/components/profile/TraditionalProfile";
import { fetchPublicProfileByUsername } from "@/lib/profile/publicProfileData";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";

export const revalidate = 300;

interface ProfilePageProps {
  params: { username: string };
}

const fetchUserData = cache(fetchPublicProfileByUsername);

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
  const { user, profileData, redirectUsername } = await fetchUserData(
    params.username,
  );

  if (!user) {
    notFound();
  }

  if (redirectUsername) {
    redirect(`/p/${redirectUsername}`);
  }

  const publicUsername = user.username || params.username;
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
          username={publicUsername}
          photoURL={user.photoURL}
          variant="full"
        />
        <ProfileAnalyticsTracker username={publicUsername} />
        <Footer />
      </>
    );
  }

  return (
    <>
      <TraditionalProfile
        user={user}
        vcardData={vcardData}
        username={publicUsername}
      />
      <ProfileFloatingActions
        username={publicUsername}
        photoURL={user.photoURL}
        variant="minimal"
      />
      <ProfileAnalyticsTracker username={publicUsername} />
      <Footer />
    </>
  );
}
