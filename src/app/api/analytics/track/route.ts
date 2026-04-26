import { adminDb } from "@/lib/firebase-admin";
import { standardRateLimit } from "@/lib/rateLimit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await standardRateLimit(request);
    if (rateLimitResult) return rateLimitResult;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { username } = body;

    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    const usersRef = adminDb.collection("users");
    const snapshot = await usersRef
      .where("username", "==", username)
      .limit(1)
      .get();

    let userRef = snapshot.docs[0]?.ref;

    if (!userRef && username.startsWith("u_")) {
      const uidDoc = await usersRef.doc(username.slice(2)).get();
      if (uidDoc.exists) {
        userRef = uidDoc.ref;
      }
    }

    if (!userRef) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const safeReferrer =
      request.headers.get("referer")?.slice(0, 500) || "direct";
    const safeUserAgent =
      request.headers.get("user-agent")?.slice(0, 500) || "unknown";

    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const newView = {
      timestamp: now,
      referrer: safeReferrer,
      userAgent: safeUserAgent,
    };

    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const currentData = userDoc.data();
      const currentRecentViews = currentData?.analytics?.recentViews || [];
      const updatedRecentViews = [newView, ...currentRecentViews].slice(0, 10);

      transaction.update(userRef, {
        "analytics.totalViews": (currentData?.analytics?.totalViews || 0) + 1,
        "analytics.lastViewedAt": now,
        [`analytics.dailyViews.${today}`]:
          (currentData?.analytics?.dailyViews?.[today] || 0) + 1,
        "analytics.recentViews": updatedRecentViews,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics tracking error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
