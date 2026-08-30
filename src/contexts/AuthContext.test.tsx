import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import * as firebaseAuth from "firebase/auth";
import * as firestore from "firebase/firestore";
import { AuthProvider, useAuth } from "./AuthContext";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createMockUser(
  overrides: Partial<firebaseAuth.User> = {},
): firebaseAuth.User {
  return {
    uid: "test-uid",
    email: "test@example.com",
    emailVerified: true,
    displayName: "Test User",
    photoURL: null,
    providerData: [],
    isAnonymous: false,
    metadata: {},
    refreshToken: "",
    tenantId: null,
    delete: jest.fn(),
    getIdToken: jest.fn(),
    getIdTokenResult: jest.fn(),
    reload: jest.fn(),
    toJSON: jest.fn(),
    phoneNumber: null,
    providerId: "firebase",
    ...overrides,
  } as firebaseAuth.User;
}

// Routerのモック
const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: jest.fn(),
  refresh: jest.fn(),
};
jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

// Firebaseのモック（jest.setup.jsのモックを上書き）
jest.mock("firebase/auth", () => ({
  ...jest.requireActual("firebase/auth"),
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  signInWithRedirect: jest.fn(),
  getRedirectResult: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
  setPersistence: jest.fn(),
  browserLocalPersistence: {},
  GoogleAuthProvider: jest.fn(() => ({
    setCustomParameters: jest.fn(),
  })),
}));

jest.mock("firebase/firestore", () => ({
  ...jest.requireActual("firebase/firestore"),
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
}));

describe("AuthContext", () => {
  let mockOnAuthStateChanged: jest.Mock;
  let mockUnsubscribe: jest.Mock;
  let authStateCallback: ((user: firebaseAuth.User | null) => void) | undefined;

  const emitAuthState = (user: firebaseAuth.User | null) => {
    if (!authStateCallback) {
      throw new Error("auth observer is not subscribed");
    }
    authStateCallback(user);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    authStateCallback = undefined;

    // onAuthStateChangedのモック設定
    mockUnsubscribe = jest.fn();
    mockOnAuthStateChanged = firebaseAuth.onAuthStateChanged as jest.Mock;
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      authStateCallback = callback;
      // 初期状態（未認証）を通知
      setTimeout(() => callback(null), 0);
      return mockUnsubscribe;
    });

    // getRedirectResultのモック（初期値）
    (firebaseAuth.getRedirectResult as jest.Mock).mockResolvedValue(null);

    // setPersistenceのモック
    (firebaseAuth.setPersistence as jest.Mock).mockResolvedValue(undefined);

    // Firestoreのモック設定
    (firestore.doc as jest.Mock).mockReturnValue({ id: "test-doc" });
    (firestore.getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
    (firestore.setDoc as jest.Mock).mockResolvedValue(undefined);

    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("AuthProvider", () => {
    it("プロバイダーが正しくレンダリングされる", () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>,
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("初期状態でloadingがtrueになる", () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBe(null);
    });

    it("認証状態の変更を監視する", async () => {
      const mockUser = {
        uid: "test-uid",
        email: "test@example.com",
        emailVerified: true,
        displayName: "Test User",
        photoURL: null,
        providerData: [],
        isAnonymous: false,
        metadata: {},
        refreshToken: "",
        tenantId: null,
        delete: jest.fn(),
        getIdToken: jest.fn(),
        getIdTokenResult: jest.fn(),
        reload: jest.fn(),
        toJSON: jest.fn(),
        phoneNumber: null,
        providerId: "firebase",
      } as firebaseAuth.User;

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
      });
    });

    it("既存プロフィールの編集値を認証情報で上書きしない", async () => {
      const mockUser = createMockUser();
      (firestore.getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          uid: mockUser.uid,
          email: "profile-contact@example.com",
          emailVerified: mockUser.emailVerified,
          displayName: "Edited Profile Name",
          photoURL: "https://example.com/custom-profile.png",
        }),
      });
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authStateCallback = callback;
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.loading).toBe(false);
      });
      expect(firestore.setDoc).toHaveBeenCalledWith(
        { id: "test-doc" },
        {
          uid: mockUser.uid,
          emailVerified: true,
          updatedAt: expect.anything(),
          username: "u_test-uid",
        },
        { merge: true },
      );
      const existingProfileUpdate = (firestore.setDoc as jest.Mock).mock
        .calls[0][1];
      expect(existingProfileUpdate).not.toHaveProperty("email");
      expect(existingProfileUpdate).not.toHaveProperty("displayName");
      expect(existingProfileUpdate).not.toHaveProperty("photoURL");
    });

    it("redirect結果とobserverが同じUIDを返しても同期は1回だけ行う", async () => {
      const mockUser = createMockUser({ uid: "redirect-observer-uid" });
      const redirectResult = createDeferred<{ user: firebaseAuth.User }>();
      (firebaseAuth.getRedirectResult as jest.Mock).mockReturnValueOnce(
        redirectResult.promise,
      );
      (firestore.getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ username: "123456789012" }),
      });
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authStateCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });
      await waitFor(() => expect(authStateCallback).toBeDefined());

      await act(async () => {
        emitAuthState(mockUser);
        redirectResult.resolve({ user: mockUser });
        await redirectResult.promise;
      });
      await waitFor(() => expect(result.current.user).toEqual(mockUser));

      expect(firestore.getDoc).toHaveBeenCalledTimes(1);
      expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    });

    it("同期中にログアウトした場合は古いユーザーを復活させない", async () => {
      const mockUser = createMockUser();
      const profileWrite = createDeferred<void>();
      (firestore.setDoc as jest.Mock).mockReturnValueOnce(profileWrite.promise);
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authStateCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });
      await waitFor(() => expect(authStateCallback).toBeDefined());

      act(() => {
        emitAuthState(mockUser);
      });
      await waitFor(() => expect(firestore.setDoc).toHaveBeenCalledTimes(1));
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);

      act(() => {
        emitAuthState(null);
      });
      await act(async () => {
        profileWrite.resolve();
        await profileWrite.promise;
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("明示サインインの同期中にログアウトしても古い結果を公開しない", async () => {
      const mockUser = createMockUser({ uid: "interactive-stale-uid" });
      const profileWrite = createDeferred<void>();
      (firestore.setDoc as jest.Mock).mockReturnValueOnce(profileWrite.promise);
      (firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authStateCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });
      await waitFor(() => expect(authStateCallback).toBeDefined());

      let signInPromise!: Promise<void>;
      act(() => {
        signInPromise = result.current.signInWithEmail(
          "test@example.com",
          "password123",
        );
      });
      await waitFor(() => expect(firestore.setDoc).toHaveBeenCalledTimes(1));

      act(() => emitAuthState(null));
      await act(async () => {
        profileWrite.resolve();
        await signInPromise;
      });

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockPush).not.toHaveBeenCalled();
    });

    it("コンポーネントのアンマウント時にunsubscribeを呼ぶ", () => {
      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("signInWithGoogle", () => {
    it("Googleサインインが成功する", async () => {
      const mockUser = {
        uid: "google-uid",
        email: "google@example.com",
        emailVerified: true,
      } as firebaseAuth.User;

      (firebaseAuth.signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled();
      expect(firestore.setDoc).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("ポップアップブロック時にリダイレクト方式を使用する", async () => {
      const error = { code: "auth/popup-blocked" };
      (firebaseAuth.signInWithPopup as jest.Mock).mockRejectedValue(error);
      (firebaseAuth.signInWithRedirect as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signInWithGoogle();
      });

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled();
    });

    it("認証エラーを適切に処理する", async () => {
      const error = {
        code: "auth/network-request-failed",
        message: "Network error",
      };
      (firebaseAuth.signInWithPopup as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await expect(result.current.signInWithGoogle()).rejects.toThrow(
          "ネットワークエラーが発生しました。接続を確認してください。",
        );
      });
    });
  });

  describe("signInWithEmail", () => {
    it("メールサインインが成功する", async () => {
      const mockUser = {
        uid: "email-uid",
        email: "user@example.com",
        emailVerified: true,
      } as firebaseAuth.User;

      (firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signInWithEmail("user@example.com", "password123");
      });

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        undefined,
        "user@example.com",
        "password123",
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("安全な内部redirectへサインイン後に遷移する", async () => {
      const mockUser = {
        uid: "email-uid",
        email: "user@example.com",
        emailVerified: true,
      } as firebaseAuth.User;

      (firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      window.history.replaceState(
        {},
        "",
        "/signin?redirect=%2Fdashboard%2Fbusiness-cards%2Fscan",
      );

      await act(async () => {
        await result.current.signInWithEmail("user@example.com", "password123");
      });

      expect(mockPush).toHaveBeenCalledWith("/dashboard/business-cards/scan");
    });

    it.each(["//evil.example/steal", "https://evil.example/steal"])(
      "危険なredirectを拒否する: %s",
      async (redirect) => {
        const mockUser = {
          uid: "email-uid",
          email: "user@example.com",
          emailVerified: true,
        } as firebaseAuth.User;

        (
          firebaseAuth.signInWithEmailAndPassword as jest.Mock
        ).mockResolvedValue({ user: mockUser });

        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        window.history.replaceState(
          {},
          "",
          `/signin?${new URLSearchParams({ redirect }).toString()}`,
        );

        await act(async () => {
          await result.current.signInWithEmail(
            "user@example.com",
            "password123",
          );
        });

        expect(mockPush).toHaveBeenCalledWith("/dashboard");
      },
    );

    it("間違ったパスワードでエラーを返す", async () => {
      const error = { code: "auth/wrong-password", message: "Wrong password" };
      (firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
        error,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await expect(
          result.current.signInWithEmail("user@example.com", "wrongpassword"),
        ).rejects.toThrow("パスワードが間違っています。");
      });
    });

    it("ユーザーが見つからない場合のエラー", async () => {
      const error = { code: "auth/user-not-found", message: "User not found" };
      (firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(
        error,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await expect(
          result.current.signInWithEmail("notfound@example.com", "password123"),
        ).rejects.toThrow(
          "アカウントが見つかりません。新規登録をお試しください。",
        );
      });
    });
  });

  describe("signUpWithEmail", () => {
    it("メールサインアップが成功する", async () => {
      const mockUser = {
        uid: "new-uid",
        email: "newuser@example.com",
        emailVerified: false,
      } as firebaseAuth.User;

      (
        firebaseAuth.createUserWithEmailAndPassword as jest.Mock
      ).mockResolvedValue({
        user: mockUser,
      });
      (firebaseAuth.updateProfile as jest.Mock).mockResolvedValue(undefined);
      (firebaseAuth.sendEmailVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signUpWithEmail(
          "newuser@example.com",
          "password123",
          "New User",
        );
      });

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: "New User",
      });
      expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(mockUser);
      expect(firestore.setDoc).toHaveBeenCalledWith(
        { id: "test-doc" },
        expect.objectContaining({
          username: expect.stringMatching(/^[1-9][0-9]{11}$/),
        }),
      );
      expect(firestore.setDoc).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ username: "newuser" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });

    it("既に使用されているメールアドレスでエラーを返す", async () => {
      const error = {
        code: "auth/email-already-in-use",
        message: "Email in use",
      };
      (
        firebaseAuth.createUserWithEmailAndPassword as jest.Mock
      ).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await expect(
          result.current.signUpWithEmail("existing@example.com", "password123"),
        ).rejects.toThrow("このメールアドレスは既に使用されています。");
      });
    });

    it("弱いパスワードでエラーを返す", async () => {
      const error = { code: "auth/weak-password", message: "Weak password" };
      (
        firebaseAuth.createUserWithEmailAndPassword as jest.Mock
      ).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await expect(
          result.current.signUpWithEmail("newuser@example.com", "123"),
        ).rejects.toThrow("パスワードは6文字以上にしてください。");
      });
    });
  });

  describe("resetPassword", () => {
    it("パスワードリセットメールが送信される", async () => {
      (firebaseAuth.sendPasswordResetEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.resetPassword("user@example.com");
      });

      expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
        undefined,
        "user@example.com",
      );
    });

    it("無効なメールアドレスでエラーを返す", async () => {
      const error = { code: "auth/invalid-email", message: "Invalid email" };
      (firebaseAuth.sendPasswordResetEmail as jest.Mock).mockRejectedValue(
        error,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(
        result.current.resetPassword("invalid-email"),
      ).rejects.toThrow("メールアドレスの形式が正しくありません。");
    });
  });

  describe("resendVerificationEmail", () => {
    it("ログインユーザーに確認メールを再送信する", async () => {
      const mockUser = {
        uid: "test-uid",
        email: "test@example.com",
        emailVerified: false,
        providerData: [{ providerId: "password" }],
      } as firebaseAuth.User;

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });
      (firebaseAuth.sendEmailVerification as jest.Mock).mockResolvedValue(
        undefined,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // ユーザーがセットされるまで待つ
      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      await act(async () => {
        await result.current.resendVerificationEmail();
      });

      expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(mockUser);
    });

    it("未ログイン時にエラーを返す", async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(result.current.resendVerificationEmail()).rejects.toThrow(
        "ユーザーがログインしていません",
      );
    });

    it("送信回数制限エラーを処理する", async () => {
      const mockUser = {
        uid: "test-uid",
        email: "test@example.com",
        providerData: [{ providerId: "password" }],
      } as firebaseAuth.User;

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const error = {
        code: "auth/too-many-requests",
        message: "Too many requests",
      };
      (firebaseAuth.sendEmailVerification as jest.Mock).mockRejectedValue(
        error,
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      await expect(result.current.resendVerificationEmail()).rejects.toThrow(
        "送信回数の上限に達しました。しばらくしてからお試しください。",
      );
    });
  });

  describe("signOut", () => {
    it("サインアウトが成功する", async () => {
      (firebaseAuth.signOut as jest.Mock).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(firebaseAuth.signOut).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/");
    });

    it("サインアウトエラーを処理する", async () => {
      const error = {
        code: "auth/network-request-failed",
        message: "Network error",
      };
      (firebaseAuth.signOut as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await expect(result.current.signOut()).rejects.toThrow(
        "ネットワークエラーが発生しました。接続を確認してください。",
      );
    });
  });

  describe("ルーティング動作", () => {
    it("サインインページでユーザーがログインしたらユーザードキュメントを作成する", async () => {
      const mockUser = {
        uid: "test-uid",
        email: "test@example.com",
        providerData: [],
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        refreshToken: "",
        tenantId: null,
        delete: jest.fn(),
        getIdToken: jest.fn(),
        getIdTokenResult: jest.fn(),
        reload: jest.fn(),
        toJSON: jest.fn(),
        displayName: null,
        photoURL: null,
        phoneNumber: null,
        providerId: "firebase",
      } as unknown as firebaseAuth.User;

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await waitFor(() => {
        expect(result.current.user).toBeTruthy();
      });

      expect(firestore.setDoc).toHaveBeenCalled();
    });

    it("認証済みユーザーをsigninの安全な内部redirectへ送る", async () => {
      const mockUser = {
        uid: "test-uid",
        email: "test@example.com",
        providerData: [],
        emailVerified: true,
      } as unknown as firebaseAuth.User;

      window.history.replaceState(
        {},
        "",
        "/signin?redirect=%2Fdashboard%2Fbusiness-cards%2Fscan",
      );
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0);
        return mockUnsubscribe;
      });

      renderHook(() => useAuth(), { wrapper: AuthProvider });

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/dashboard/business-cards/scan");
      });
    });

    it("ログアウト時にユーザー状態がクリアされる", async () => {
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(null), 0);
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("useAuth フック", () => {
    it("AuthProvider外でもデフォルト値が返される", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const { result } = renderHook(() => useAuth());

      expect(result.current).toBeDefined();
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);

      consoleSpy.mockRestore();
    });
  });
});
