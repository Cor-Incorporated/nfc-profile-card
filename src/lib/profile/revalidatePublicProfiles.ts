import { revalidatePath } from "next/cache";

// The public UID path is owned only when it contains the exact UID. The
// legacy getUidFallbackUsername helper strips characters and can point at a
// different account for custom UIDs.
export function getOwnedUidFallbackUsername(uid: string): string | null {
  return /^[a-zA-Z0-9_-]{1,148}$/.test(uid) ? `u_${uid}` : null;
}

export function revalidatePublicProfiles(...usernames: unknown[]) {
  const paths = new Set<string>();

  for (const value of usernames) {
    if (typeof value !== "string") continue;
    const username = value.trim();
    // revalidatePath accepts an arbitrary path. Only public profile segments
    // produced by our username and UID fallback formats may reach it.
    if (!/^[a-zA-Z0-9_-]{1,150}$/.test(username)) continue;

    paths.add(`/p/${encodeURIComponent(username)}`);
    // Firebase UIDs are case sensitive; the lower-case variant could belong
    // to a different user and must not be invalidated.
    if (!username.startsWith("u_")) {
      paths.add(`/p/${encodeURIComponent(username.toLowerCase())}`);
    }
  }

  for (const path of paths) revalidatePath(path);
}
