import { adminDb } from "@/lib/firebase-admin";
import { getUidFallbackUsername } from "@/lib/username";

// Public lookup gives reservations precedence, then tries normalized and exact
// legacy usernames. Verify against the same order before accepting a cached
// path from an owner-writable users/{uid}.username field.
export async function ownsPublicUsername(uid: string, username: unknown) {
  if (typeof username !== "string" || !username) return false;

  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,150}$/.test(normalized)) return false;

  const reservation = await adminDb
    .collection("usernames")
    .doc(normalized)
    .get();
  if (reservation.exists) return reservation.data()?.uid === uid;

  // The UID fallback is resolved before legacy username queries. A directly
  // edited users.username may not claim another user's fallback URL.
  if (username.startsWith("u_")) {
    return username === getUidFallbackUsername(uid);
  }

  const alias = await adminDb
    .collection("usernameAliases")
    .doc(normalized)
    .get();
  if (alias.exists && alias.data()?.status === "redirect") {
    return alias.data()?.uid === uid;
  }

  const matchingNormalized = await adminDb
    .collection("users")
    .where("username", "==", normalized)
    .limit(2)
    .get();
  if (!matchingNormalized.empty) {
    return matchingNormalized.docs.every((doc) => doc.id === uid);
  }

  if (username === normalized) return false;
  const matchingExact = await adminDb
    .collection("users")
    .where("username", "==", username)
    .limit(2)
    .get();
  return (
    !matchingExact.empty && matchingExact.docs.every((doc) => doc.id === uid)
  );
}
