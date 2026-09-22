import { revalidatePath } from "next/cache";

export function revalidatePublicProfiles(...usernames: unknown[]) {
  const paths = new Set<string>();

  for (const value of usernames) {
    if (typeof value !== "string") continue;
    const username = value.trim();
    // revalidatePath accepts an arbitrary path. Only public profile segments
    // produced by our username and UID fallback formats may reach it.
    if (!/^[a-zA-Z0-9_-]{1,150}$/.test(username)) continue;

    paths.add(`/p/${encodeURIComponent(username)}`);
    paths.add(`/p/${encodeURIComponent(username.toLowerCase())}`);
  }

  for (const path of paths) revalidatePath(path);
}
