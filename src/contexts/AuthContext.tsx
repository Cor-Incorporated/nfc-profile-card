"use client";

import { auth, db } from "@/lib/firebase";
import {
  generateDefaultUsername,
  getUidFallbackUsername,
} from "@/lib/username";
import {
  AuthError,
  GoogleAuthProvider,
  User,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ROUTES, getRedirectUrl } from "@/lib/constants/routes";

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

const PROFILE_SYNC_ERROR_MESSAGE =
  "プロフィールの準備に失敗しました。通信環境を確認して、もう一度お試しください。";

class ProfileSyncError extends Error {
  constructor() {
    super(PROFILE_SYNC_ERROR_MESSAGE);
    this.name = "ProfileSyncError";
  }
}

interface ActiveAuthOperation {
  uid: string | null;
  observedUid: string | null;
  loggedOutUid: string | null;
  invalidated: boolean;
}

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

const getUserFacingErrorMessage = (error: unknown): string => {
  if (error instanceof ProfileSyncError) {
    return error.message;
  }

  return getErrorMessage(error as AuthError);
};

function getCurrentSignInRedirect(): string {
  if (typeof window === "undefined") {
    return ROUTES.DASHBOARD;
  }

  return getRedirectUrl(new URLSearchParams(window.location.search));
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const activeAuthOperationRef = useRef<ActiveAuthOperation | null>(null);
  const profileSyncRef = useRef<{
    uid: string;
    promise: Promise<void>;
  } | null>(null);
  const router = useRouter();

  // 認証の永続性を設定
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        // Auth persistence set to LOCAL
      })
      .catch((error) => {
        console.error("Error setting auth persistence:", error);
      });
  }, []);

  // 同じ認証イベントとサインイン処理が競合しても、初期化は UID ごとに1回だけ行う。
  const createOrUpdateUserDocument = useCallback((user: User) => {
    if (profileSyncRef.current?.uid === user.uid) {
      return profileSyncRef.current.promise;
    }

    const promise = (async () => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      const authProfile = {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.displayName,
        photoURL: user.photoURL,
      };

      if (!userSnap.exists()) {
        // 新規ユーザーの場合
        await setDoc(userRef, {
          ...authProfile,
          updatedAt: serverTimestamp(),
          username: generateDefaultUsername(),
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
      } else {
        const existingData = userSnap.data() ?? {};

        // email / displayName / photoURL はプロフィール編集側の所有値なので、
        // 認証情報で上書きしない。認証側が所有する検証状態と必須 ID だけ同期する。
        await setDoc(
          userRef,
          {
            uid: user.uid,
            emailVerified: user.emailVerified,
            updatedAt: serverTimestamp(),
            ...(!existingData.username
              ? { username: getUidFallbackUsername(user.uid) }
              : {}),
          },
          { merge: true },
        );
      }
    })().catch((error) => {
      console.error("Error creating/updating user document:", error);
      throw new ProfileSyncError();
    });

    profileSyncRef.current = { uid: user.uid, promise };
    // observer と明示サインインが同時に同じ UID を返す間だけ共有する。
    // 完了後は emailVerified 等の後続変更を同期できるよう解放する。
    const releasePromise = () => {
      if (profileSyncRef.current?.promise === promise) {
        profileSyncRef.current = null;
      }
    };
    void promise.then(releasePromise, releasePromise);

    return promise;
  }, []);

  const publishAuthenticatedUser = useCallback(
    async (
      authenticatedUser: User,
      redirectTo?: string,
      canPublish: () => boolean = () => true,
    ) => {
      await createOrUpdateUserDocument(authenticatedUser);

      if (!canPublish()) {
        return;
      }

      setUser(authenticatedUser);
      setLoading(false);

      if (redirectTo) {
        router.push(redirectTo);
      }
    },
    [createOrUpdateUserDocument, router],
  );

  const handleProfileSyncFailure = useCallback((error: unknown) => {
    const message = getUserFacingErrorMessage(error);
    setUser(null);
    setLoading(false);
    return message;
  }, []);

  const handleAuthOperationFailure = (
    operation: ActiveAuthOperation,
    error: unknown,
  ) => {
    const message = getUserFacingErrorMessage(error);
    if (activeAuthOperationRef.current !== operation) {
      return message;
    }

    if (error instanceof ProfileSyncError) {
      return handleProfileSyncFailure(error);
    }

    setLoading(false);
    return message;
  };

  const beginAuthOperation = () => {
    const operation: ActiveAuthOperation = {
      uid: null,
      observedUid: null,
      loggedOutUid: null,
      invalidated: false,
    };
    activeAuthOperationRef.current = operation;
    setUser(null);
    setLoading(true);
    return operation;
  };

  const publishInteractiveUser = async (
    operation: ActiveAuthOperation,
    authenticatedUser: User,
    redirectTo: string,
  ) => {
    operation.uid = authenticatedUser.uid;
    if (operation.loggedOutUid === authenticatedUser.uid) {
      operation.invalidated = true;
    }

    if (operation.invalidated) {
      return;
    }

    await publishAuthenticatedUser(
      authenticatedUser,
      redirectTo,
      () =>
        activeAuthOperationRef.current === operation && !operation.invalidated,
    );
  };

  const endAuthOperation = (operation: ActiveAuthOperation) => {
    if (activeAuthOperationRef.current !== operation) {
      return;
    }

    activeAuthOperationRef.current = null;
    if (operation.invalidated) {
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let authStateVersion = 0;

    // 認証状態の公開とプロフィール初期化は observer の1経路に集約する。
    // redirect result は認証エラーの観測にだけ使い、重複同期を起動しない。
    void getRedirectResult(auth).catch((error) => {
      if (error.code !== "auth/popup-closed-by-user") {
        console.error("Error getting redirect result:", error);
      }
    });

    // 認証状態の監視
    const unsubscribe = onAuthStateChanged(auth, (authenticatedUser) => {
      const version = ++authStateVersion;

      // 明示的なサインイン処理側が、プロフィール更新後に状態を公開する。
      const activeOperation = activeAuthOperationRef.current;
      if (activeOperation) {
        if (authenticatedUser) {
          activeOperation.observedUid = authenticatedUser.uid;
          if (
            activeOperation.uid &&
            activeOperation.uid !== authenticatedUser.uid
          ) {
            activeOperation.invalidated = true;
          }
        } else {
          const loggedOutUid =
            activeOperation.uid ?? activeOperation.observedUid;
          if (loggedOutUid) {
            activeOperation.loggedOutUid = loggedOutUid;
            if (activeOperation.uid) {
              activeOperation.invalidated = true;
              profileSyncRef.current = null;
              setUser(null);
              setLoading(false);
            }
          }
        }
        return;
      }

      if (!authenticatedUser) {
        profileSyncRef.current = null;
        setUser(null);
        setLoading(false);
        if (window.location.pathname.startsWith("/dashboard")) {
          router.push("/signin");
        }
        return;
      }

      setLoading(true);
      setUser(null);
      const redirectTo =
        window.location.pathname === ROUTES.SIGNIN
          ? getCurrentSignInRedirect()
          : undefined;

      void publishAuthenticatedUser(
        authenticatedUser,
        redirectTo,
        () => !cancelled && version === authStateVersion,
      ).catch((error) => {
        if (!cancelled && version === authStateVersion) {
          handleProfileSyncFailure(error);
        }
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [handleProfileSyncFailure, publishAuthenticatedUser, router]);

  // Googleでサインイン
  const signInWithGoogle = async () => {
    const redirectTo = getCurrentSignInRedirect();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const operation = beginAuthOperation();

    try {
      const result = await signInWithPopup(auth, provider);
      await publishInteractiveUser(operation, result.user, redirectTo);
    } catch (error: any) {
      console.error("Google sign in error:", error);
      // ポップアップがブロックされた場合のみ、リダイレクト方式へフォールバック
      if (
        error?.code === "auth/popup-blocked" ||
        (process.env.NODE_ENV === "development" &&
          (error?.code === "auth/popup-closed-by-user" ||
            error?.code === "auth/cancelled-popup-request"))
      ) {
        try {
          await signInWithRedirect(auth, provider);
          if (activeAuthOperationRef.current === operation) {
            setLoading(false);
          }
          return; // 結果は getRedirectResult で処理
        } catch (redirectErr: any) {
          console.error("Google redirect sign in error:", redirectErr);
          throw new Error(handleAuthOperationFailure(operation, redirectErr));
        }
      }

      throw new Error(handleAuthOperationFailure(operation, error));
    } finally {
      endAuthOperation(operation);
    }
  };

  // メールとパスワードでサインイン
  const signInWithEmail = async (email: string, password: string) => {
    const redirectTo = getCurrentSignInRedirect();
    const operation = beginAuthOperation();

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      await publishInteractiveUser(operation, result.user, redirectTo);
    } catch (error: any) {
      console.error("Email sign in error:", error);
      throw new Error(handleAuthOperationFailure(operation, error));
    } finally {
      endAuthOperation(operation);
    }
  };

  // メールとパスワードでサインアップ
  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    const redirectTo = getCurrentSignInRedirect();
    const operation = beginAuthOperation();

    try {
      // アカウント作成
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      // プロフィール更新
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }

      // 確認メール送信
      await sendEmailVerification(result.user);

      await publishInteractiveUser(operation, result.user, redirectTo);
    } catch (error: any) {
      console.error("Email sign up error:", error);
      throw new Error(handleAuthOperationFailure(operation, error));
    } finally {
      endAuthOperation(operation);
    }
  };

  // パスワードリセット
  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
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
