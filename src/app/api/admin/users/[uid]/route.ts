import { verifyAdminRequest } from "@/lib/admin";
import { adminDb } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: {
    uid: string;
  };
}

function isLikelyEmailDerivedUsername(username?: string, email?: string) {
  if (!username || !email || !email.includes("@")) return false;
  return username === email.split("@")[0];
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status },
      );
    }

    const userDoc = await adminDb.collection("users").doc(params.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const data = userDoc.data() || {};

    return NextResponse.json({
      uid: params.uid,
      email: data.email || null,
      name: data.name || data.displayName || "",
      username: data.username || "",
      isLikelyEmailDerivedUsername: isLikelyEmailDerivedUsername(
        data.username,
        data.email,
      ),
    });
  } catch (error) {
    console.error("Admin user lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to lookup user" },
      { status: 500 },
    );
  }
}
