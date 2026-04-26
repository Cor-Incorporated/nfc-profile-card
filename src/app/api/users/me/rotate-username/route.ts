import { adminDb, verifyIdToken } from "@/lib/firebase-admin";
import { generateDefaultUsername } from "@/lib/username";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const username = generateDefaultUsername();
    const snapshot = await adminDb
      .collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return username;
    }
  }

  throw new Error("Failed to generate unique username");
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const verification = await verifyIdToken(token);
    if (!verification.success || !verification.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRef = adminDb.collection("users").doc(verification.uid);
    const username = await generateUniqueUsername();
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        return null;
      }

      const data = userDoc.data() || {};
      const previousUsername = data.username || "";
      const updateData: Record<string, unknown> = {
        username,
        usernameRotatedAt: FieldValue.serverTimestamp(),
        usernameRotatedBy: verification.uid,
        usernameRotatedBySelf: true,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (previousUsername) {
        updateData.previousUsernames = FieldValue.arrayUnion(previousUsername);
      }

      transaction.update(userRef, updateData);

      return {
        previousUsername,
        username,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Self-service username rotation failed:", error);
    return NextResponse.json(
      { error: "Failed to rotate username" },
      { status: 500 },
    );
  }
}
