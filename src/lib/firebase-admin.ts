import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    // Use environment variables for Firebase Admin SDK
    if (
      process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL
    ) {
      console.log("[firebase-admin] Initializing with environment variables");
      const serviceAccount = {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "nfc-profile-card",
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(
          /\\n/g,
          "\n",
        ),
      };

      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("[firebase-admin] Initialized successfully with environment variables");
    } else if (process.env.NODE_ENV === "development") {
      // Only try to load service account file in development
      try {
        console.log("[firebase-admin] Initializing in development mode");
        const serviceAccount = require("../../nfc-profile-card-firebase-adminsdk-fbsvc-832eaa1a80.json");
        initializeApp({
          credential: cert(serviceAccount),
        });
        console.log("[firebase-admin] Initialized successfully with service account file");
      } catch (e) {
        console.warn(
          "[firebase-admin] Service account file not found. Using default config.",
        );
        initializeApp();
      }
    } else {
      // Production without environment variables - use default
      console.warn("[firebase-admin] Credentials not configured properly, using default");
      initializeApp();
    }
  } catch (error) {
    console.error("[firebase-admin] Failed to initialize:", error);
    throw error;
  }
} else {
  console.log("[firebase-admin] Already initialized");
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();

// Helper function to create a user document
export async function createUserDocument(userData: {
  uid: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}) {
  const userRef = adminDb.collection("users").doc(userData.uid);

  const userDoc = {
    uid: userData.uid,
    email: userData.email,
    username: userData.username || userData.email.split("@")[0],
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      name:
        `${userData.firstName || ""} ${userData.lastName || ""}`.trim() ||
        userData.email.split("@")[0],
      links: [],
    },
    cards: [],
    subscription: {
      plan: "free" as const,
    },
  };

  await userRef.set(userDoc);
  return userDoc;
}

// Helper function to update a user document
export async function updateUserDocument(uid: string, updates: any) {
  const userRef = adminDb.collection("users").doc(uid);
  await userRef.update({
    ...updates,
    updatedAt: new Date(),
  });
}

// Helper function to delete a user document
export async function deleteUserDocument(uid: string) {
  const userRef = adminDb.collection("users").doc(uid);
  await userRef.update({
    deleted: true,
    deletedAt: new Date(),
  });
}

// Helper function to verify Firebase ID token
export async function verifyIdToken(idToken: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return {
      success: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
    };
  } catch (error) {
    console.error("Error verifying ID token:", error);
    return {
      success: false,
      error: "Invalid or expired token",
    };
  }
}
