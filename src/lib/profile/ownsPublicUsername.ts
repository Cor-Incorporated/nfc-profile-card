import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";

// The invalidation target must resolve to this same user in the public route.
// The stored username alone is not proof of ownership.
export async function ownsPublicUsername(uid: string, username: unknown) {
  if (typeof username !== "string") return false;
  if (!/^[a-zA-Z0-9_-]{1,150}$/.test(username)) return false;
  return (await resolvePublicProfileOwner(username)) === uid;
}
