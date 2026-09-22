import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { getDesignRevision } from "@/lib/profile/designRevision";
import { getOwnedRedirectAliases } from "@/lib/profile/getOwnedRedirectAliases";
import { parseDesignSave } from "@/lib/profile/parseDesignSave";
import { resolvePublicProfileOwner } from "@/lib/profile/publicProfileData";
import {
  getOwnedUidFallbackUsername,
  revalidatePublicProfiles,
} from "@/lib/profile/revalidatePublicProfiles";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

const MAX_BODY_BYTES = 256 * 1024;

export async function PUT(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const verified = await verifyIdToken(token);
  if (!verified.success || !verified.uid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "design_too_large" }, { status: 413 });
    }
    let input: unknown;
    try {
      input = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "invalid_design" }, { status: 400 });
    }
    const design = parseDesignSave(input);
    if (!design) {
      return NextResponse.json({ error: "invalid_design" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(verified.uid);
    const designRef = userRef.collection("profile").doc("data");
    const updatedAt = Timestamp.now();
    const username = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const designDoc = await transaction.get(designRef);
      if (!userDoc.exists) throw new Error("USER_NOT_FOUND");
      if (getDesignRevision(designDoc.data()?.updatedAt) !== design.revision) {
        throw new Error("DESIGN_CONFLICT");
      }
      transaction.set(
        designRef,
        {
          components: design.components,
          background: design.background,
          updatedAt,
        },
        { merge: true },
      );
      return userDoc.data()?.username;
    });

    const revision = getDesignRevision(updatedAt);
    try {
      const nameOwner =
        typeof username === "string"
          ? await resolvePublicProfileOwner(username)
          : null;
      const aliases = await getOwnedRedirectAliases(verified.uid);
      revalidatePublicProfiles(
        nameOwner === verified.uid ? username : null,
        getOwnedUidFallbackUsername(verified.uid),
        ...aliases,
      );
    } catch (error) {
      // The Firestore commit has already succeeded. Return its revision so a
      // retry does not overwrite another tab while invalidation is unresolved.
      console.error("Design invalidation failed:", error);
      return NextResponse.json(
        { error: "invalidation_failed", committedRevision: revision },
        { status: 503 },
      );
    }

    return NextResponse.json({ revision });
  } catch (error) {
    if (error instanceof Error && error.message === "DESIGN_CONFLICT") {
      return NextResponse.json({ error: "design_conflict" }, { status: 409 });
    }
    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
    console.error("Design save failed:", error);
    return NextResponse.json({ error: "design_save_failed" }, { status: 500 });
  }
}
