import { verifyAdminRequest } from "@/lib/admin";
import { adminDb } from "@/lib/firebase-admin";
import { generateDefaultUsername } from "@/lib/username";
import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: {
    uid: string;
  };
}

async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
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

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await verifyAdminRequest(request);
    if (!admin.ok) {
      return NextResponse.json(
        { error: admin.error },
        { status: admin.status },
      );
    }

    const userRef = adminDb.collection("users").doc(params.uid);
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
        usernameRotatedBy: admin.decodedToken.uid,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (previousUsername) {
        updateData.previousUsernames = FieldValue.arrayUnion(previousUsername);
      }

      transaction.update(userRef, updateData);

      return {
        uid: params.uid,
        previousUsername,
        username,
      };
    });

    if (!result) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Admin username rotation failed:", error);
    return NextResponse.json(
      { error: "Failed to rotate username" },
      { status: 500 },
    );
  }
}
