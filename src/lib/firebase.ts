import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase設定とドメインの確認
if (typeof window !== "undefined") {
  const currentDomain = window.location.hostname;
  console.log("Firebase Auth Debug:", {
    currentDomain,
    authDomain: firebaseConfig.authDomain,
    isVercelPreview: currentDomain.includes("vercel.app"),
    config: {
      apiKey: firebaseConfig.apiKey ? "✓ Set" : "✗ Missing",
      authDomain: firebaseConfig.authDomain || "✗ Missing",
      projectId: firebaseConfig.projectId || "✗ Missing",
      storageBucket: firebaseConfig.storageBucket || "✗ Missing",
      messagingSenderId: firebaseConfig.messagingSenderId
        ? "✓ Set"
        : "✗ Missing",
      appId: firebaseConfig.appId ? "✓ Set" : "✗ Missing",
    },
  });

  // authDomainが正しい形式かチェック
  if (
    firebaseConfig.authDomain &&
    !firebaseConfig.authDomain.includes("firebaseapp.com")
  ) {
    console.warn("⚠️ authDomain should be [PROJECT_ID].firebaseapp.com format");
  }
}

// Initialize Firebase
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

export default app;
