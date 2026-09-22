import { adminDb } from "@/lib/firebase-admin";

// Only server-managed aliases owned by this user may be invalidated. The
// owner-writable previousUsernames field is not an authorization source.
export async function getOwnedRedirectAliases(uid: string): Promise<string[]> {
  const snapshot = await adminDb
    .collection("usernameAliases")
    .where("uid", "==", uid)
    .get();

  return snapshot.docs
    .filter((doc) => doc.data().status === "redirect")
    .map((doc) => doc.id);
}
