"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  AuthError,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  resetPassword: async () => {},
  resendVerificationEmail: async () => {},
  signOut: async () => {},
  getIdToken: async () => null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// エラーメッセージの日本語化
const getErrorMessage = (error: AuthError): string => {
  switch (error.code) {
    case "auth/invalid-email":
      return "メールアドレスの形式が正しくありません。";
    case "auth/user-disabled":
      return "このアカウントは無効化されています。";
    case "auth/user-not-found":
      return "アカウントが見つかりません。新規登録をお試しください。";
    case "auth/wrong-password":
      return "パスワードが間違っています。";
    case "auth/email-already-in-use":
      return "このメールアドレスは既に使用されています。";
    case "auth/weak-password":
      return "パスワードは6文字以上にしてください。";
    case "auth/operation-not-allowed":
      return "このログイン方法は現在利用できません。";
    case "auth/popup-blocked":
      return "ポップアップがブロックされました。ブラウザの設定を確認してください。";
    case "auth/popup-closed-by-user":
      return "ログインがキャンセルされました。";
    case "auth/invalid-credential":
      return "メールアドレスまたはパスワードが間違っています。";
    case "auth/network-request-failed":
      return "ネットワークエラーが発生しました。接続を確認してください。";
    case "auth/too-many-requests":
      return "ログイン試行回数が多すぎます。しばらくしてからお試しください。";
    case "auth/missing-password":
      return "パスワードを入力してください。";
    default:
      return `認証エラーが発生しました: ${error.message}`;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 認証の永続性を設定
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log("Auth persistence set to LOCAL");
      })
      .catch((error) => {
        console.error("Error setting auth persistence:", error);
      });
  }, []);

  // ユーザードキュメントを作成/更新
  const createOrUpdateUserDocument = async (user: User) => {
    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const userData = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
        updatedAt: serverTimestamp(),
      };

      if (!userSnap.exists()) {
        // 新規ユーザーの場合
        await setDoc(userRef, {
          ...userData,
          username: user.email?.split("@")[0] || `user_${user.uid.slice(0, 8)}`,
          createdAt: serverTimestamp(),
          name: user.displayName || "",
          bio: "",
          company: "",
          position: "",
          phone: "",
          website: "",
          address: "",
          links: [],
          cards: [],
          subscription: {
            plan: "free",
            startedAt: serverTimestamp(),
          },
        });
        console.log("New user document created");
      } else {
        // 既存ユーザーの場合は更新
        await setDoc(userRef, userData, { merge: true });
        console.log("User document updated");
      }
    } catch (error) {
      console.error("Error creating/updating user document:", error);
    }
  };

  useEffect(() => {
    // リダイレクト結果を確認（Googleサインイン用）
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          console.log("Redirect result user:", result.user.email);
          await createOrUpdateUserDocument(result.user);
          router.push("/dashboard");
        }
      })
      .catch((error) => {
        if (error.code !== "auth/popup-closed-by-user") {
          console.error("Error getting redirect result:", error);
        }
      });

    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("Auth state changed:", user?.email || "No user");

      if (user) {
        await createOrUpdateUserDocument(user);
        setUser(user);

        // メール未確認の場合の警告
        if (
          !user.emailVerified &&
          user.providerData[0]?.providerId === "password"
        ) {
          console.log("User email not verified");
        }

        // サインインページにいる場合はダッシュボードへリダイレクト
        if (window.location.pathname === "/signin") {
          router.push("/dashboard");
        }
      } else {
        setUser(null);
        // 保護されたページにいる場合はサインインページへリダイレクト
        if (window.location.pathname.startsWith("/dashboard")) {
          router.push("/signin");
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // Googleでサインイン
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // Google認証画面で毎回アカウント選択を表示
    provider.setCustomParameters({
      prompt: "select_account",
    });

    try {
      // リダイレクト方式を使用（COOPエラーを回避）
      await signInWithRedirect(auth, provider);
      // リダイレクト後の処理はgetRedirectResultで行う
    } catch (error: any) {
      console.error("Google sign in error:", error);
      throw new Error(getErrorMessage(error));
    }
  };

  // メールとパスワードでサインイン
  const signInWithEmail = async (email: string, password: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      console.log("Email sign in successful:", result.user.email);
      await createOrUpdateUserDocument(result.user);

      // メール確認の警告
      if (!result.user.emailVerified) {
        console.log("Warning: Email not verified");
      }

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Email sign in error:", error);
      throw new Error(getErrorMessage(error));
    }
  };

  // メールとパスワードでサインアップ
  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    try {
      // アカウント作成
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      console.log("Account created:", result.user.email);

      // プロフィール更新
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      // 確認メール送信
      await sendEmailVerification(result.user);
      console.log("Verification email sent");

      // ユーザードキュメント作成
      await createOrUpdateUserDocument(result.user);

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Email sign up error:", error);
      throw new Error(getErrorMessage(error));
    }
  };

  // パスワードリセット
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      console.log("Password reset email sent to:", email);
    } catch (error: any) {
      console.error("Password reset error:", error);
      throw new Error(getErrorMessage(error));
    }
  };

  // 確認メール再送信
  const resendVerificationEmail = async () => {
    if (!user) {
      throw new Error("ユーザーがログインしていません");
    }

    try {
      await sendEmailVerification(user);
      console.log("Verification email resent");
    } catch (error: any) {
      console.error("Resend verification email error:", error);
      if (error.code === "auth/too-many-requests") {
        throw new Error(
          "送信回数の上限に達しました。しばらくしてからお試しください。",
        );
      }
      throw new Error(getErrorMessage(error));
    }
  };

  // サインアウト
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      console.log("User signed out");
      router.push("/");
    } catch (error: any) {
      console.error("Sign out error:", error);
      throw new Error(getErrorMessage(error));
    }
  };

  // IDトークンを取得
  const getIdToken = async (): Promise<string | null> => {
    if (!user) {
      return null;
    }
    try {
      const token = await user.getIdToken();
      return token;
    } catch (error) {
      console.error("Error getting ID token:", error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        resetPassword,
        resendVerificationEmail,
        signOut,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
