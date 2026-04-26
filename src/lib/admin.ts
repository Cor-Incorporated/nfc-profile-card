import { adminAuth } from "@/lib/firebase-admin";
import type { NextRequest } from "next/server";

function parseAdminList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyAdminRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const idToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!idToken) {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifyIdToken(idToken);
  } catch {
    return { ok: false as const, status: 401, error: "Unauthorized" };
  }
  const adminEmails = parseAdminList(process.env.ADMIN_EMAILS);
  const adminUids = parseAdminList(process.env.ADMIN_UIDS);
  const email = decodedToken.email?.toLowerCase();
  const uid = decodedToken.uid.toLowerCase();

  if (
    (email && adminEmails.includes(email)) ||
    (uid && adminUids.includes(uid))
  ) {
    return { ok: true as const, decodedToken };
  }

  return { ok: false as const, status: 403, error: "Forbidden" };
}
