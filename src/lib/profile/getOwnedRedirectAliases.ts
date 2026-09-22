import { adminDb } from "@/lib/firebase-admin";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";

// Alias documents can be shadowed by a UID path or another user's username
// reservation. Invalidate only URLs that currently resolve to this user.
export async function getOwnedRedirectAliases(uid: string): Promise<string[]> {
  const snapshot = await adminDb
    .collection("usernameAliases")
    .where("uid", "==", uid)
    .get();

  const redirectIds = snapshot.docs
    .filter((doc) => doc.data().status === "redirect")
    .map((doc) => doc.id);
  const owners = await Promise.all(
    redirectIds.map((aliasId) => resolvePublicProfileOwner(aliasId)),
  );
  return redirectIds.filter((_, index) => owners[index] === uid);
}
