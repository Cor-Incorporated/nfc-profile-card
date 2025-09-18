import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import * as firebaseAuth from 'firebase/auth'
import * as firestore from 'firebase/firestore'
import { AuthProvider, useAuth } from './AuthContext'

// Routerのモック
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}))

// Firebaseのモック（jest.setup.jsのモックを上書き）
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
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
}))

jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => ({ _seconds: Date.now() / 1000 })),
}))

describe('AuthContext', () => {
  let mockOnAuthStateChanged: jest.Mock
  let mockUnsubscribe: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()

    // onAuthStateChangedのモック設定
    mockUnsubscribe = jest.fn()
    mockOnAuthStateChanged = firebaseAuth.onAuthStateChanged as jest.Mock
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      // 初期状態（未認証）を通知
      setTimeout(() => callback(null), 0)
      return mockUnsubscribe
    })

    // getRedirectResultのモック（初期値）
    ;(firebaseAuth.getRedirectResult as jest.Mock).mockResolvedValue(null)

    // setPersistenceのモック
    ;(firebaseAuth.setPersistence as jest.Mock).mockResolvedValue(undefined)

    // Firestoreのモック設定
    ;(firestore.doc as jest.Mock).mockReturnValue({ id: 'test-doc' })
    ;(firestore.getDoc as jest.Mock).mockResolvedValue({ exists: () => false })
    ;(firestore.setDoc as jest.Mock).mockResolvedValue(undefined)

    // window.location のモック
    delete (window as any).location
    window.location = { pathname: '/' } as any
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('AuthProvider', () => {
    it('プロバイダーが正しくレンダリングされる', () => {
      render(
        <AuthProvider>
          <div>Test Content</div>
        </AuthProvider>
      )

      expect(screen.getByText('Test Content')).toBeInTheDocument()
    })

    it('初期状態でloadingがtrueになる', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      expect(result.current.loading).toBe(true)
      expect(result.current.user).toBe(null)
    })

    it('認証状態の変更を監視する', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: true,
        displayName: 'Test User',
        photoURL: null,
        providerData: [],
        isAnonymous: false,
        metadata: {},
        refreshToken: '',
        tenantId: null,
        delete: jest.fn(),
        getIdToken: jest.fn(),
        getIdTokenResult: jest.fn(),
        reload: jest.fn(),
        toJSON: jest.fn(),
        phoneNumber: null,
        providerId: 'firebase',
      } as firebaseAuth.User

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0)
        return mockUnsubscribe
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
        expect(result.current.user).toEqual(mockUser)
      })
    })

    it('コンポーネントのアンマウント時にunsubscribeを呼ぶ', () => {
      const { unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('signInWithGoogle', () => {
    it('Googleサインインが成功する', async () => {
      const mockUser = {
        uid: 'google-uid',
        email: 'google@example.com',
        emailVerified: true,
      } as firebaseAuth.User

      ;(firebaseAuth.signInWithPopup as jest.Mock).mockResolvedValue({
        user: mockUser,
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.signInWithGoogle()
      })

      expect(firebaseAuth.signInWithPopup).toHaveBeenCalled()
      expect(firestore.setDoc).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('ポップアップブロック時にリダイレクト方式を使用する', async () => {
      const error = { code: 'auth/popup-blocked' }
      ;(firebaseAuth.signInWithPopup as jest.Mock).mockRejectedValue(error)
      ;(firebaseAuth.signInWithRedirect as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.signInWithGoogle()
      })

      expect(firebaseAuth.signInWithRedirect).toHaveBeenCalled()
    })

    it('認証エラーを適切に処理する', async () => {
      const error = { code: 'auth/network-request-failed', message: 'Network error' }
      ;(firebaseAuth.signInWithPopup as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(result.current.signInWithGoogle()).rejects.toThrow(
        'ネットワークエラーが発生しました。接続を確認してください。'
      )
    })
  })

  describe('signInWithEmail', () => {
    it('メールサインインが成功する', async () => {
      const mockUser = {
        uid: 'email-uid',
        email: 'user@example.com',
        emailVerified: true,
      } as firebaseAuth.User

      ;(firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.signInWithEmail('user@example.com', 'password123')
      })

      expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith(
        undefined,
        'user@example.com',
        'password123'
      )
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('間違ったパスワードでエラーを返す', async () => {
      const error = { code: 'auth/wrong-password', message: 'Wrong password' }
      ;(firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(
        result.current.signInWithEmail('user@example.com', 'wrongpassword')
      ).rejects.toThrow('パスワードが間違っています。')
    })

    it('ユーザーが見つからない場合のエラー', async () => {
      const error = { code: 'auth/user-not-found', message: 'User not found' }
      ;(firebaseAuth.signInWithEmailAndPassword as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(
        result.current.signInWithEmail('notfound@example.com', 'password123')
      ).rejects.toThrow('アカウントが見つかりません。新規登録をお試しください。')
    })
  })

  describe('signUpWithEmail', () => {
    it('メールサインアップが成功する', async () => {
      const mockUser = {
        uid: 'new-uid',
        email: 'newuser@example.com',
        emailVerified: false,
      } as firebaseAuth.User

      ;(firebaseAuth.createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
        user: mockUser,
      })
      ;(firebaseAuth.updateProfile as jest.Mock).mockResolvedValue(undefined)
      ;(firebaseAuth.sendEmailVerification as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.signUpWithEmail(
          'newuser@example.com',
          'password123',
          'New User'
        )
      })

      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalled()
      expect(firebaseAuth.updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: 'New User',
      })
      expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(mockUser)
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('既に使用されているメールアドレスでエラーを返す', async () => {
      const error = { code: 'auth/email-already-in-use', message: 'Email in use' }
      ;(firebaseAuth.createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(
        result.current.signUpWithEmail('existing@example.com', 'password123')
      ).rejects.toThrow('このメールアドレスは既に使用されています。')
    })

    it('弱いパスワードでエラーを返す', async () => {
      const error = { code: 'auth/weak-password', message: 'Weak password' }
      ;(firebaseAuth.createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(
        result.current.signUpWithEmail('newuser@example.com', '123')
      ).rejects.toThrow('パスワードは6文字以上にしてください。')
    })
  })

  describe('resetPassword', () => {
    it('パスワードリセットメールが送信される', async () => {
      ;(firebaseAuth.sendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.resetPassword('user@example.com')
      })

      expect(firebaseAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
        undefined,
        'user@example.com'
      )
    })

    it('無効なメールアドレスでエラーを返す', async () => {
      const error = { code: 'auth/invalid-email', message: 'Invalid email' }
      ;(firebaseAuth.sendPasswordResetEmail as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(result.current.resetPassword('invalid-email')).rejects.toThrow(
        'メールアドレスの形式が正しくありません。'
      )
    })
  })

  describe('resendVerificationEmail', () => {
    it('ログインユーザーに確認メールを再送信する', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        emailVerified: false,
      } as firebaseAuth.User

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0)
        return mockUnsubscribe
      })

      ;(firebaseAuth.sendEmailVerification as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      // ユーザーがセットされるまで待つ
      await waitFor(() => {
        expect(result.current.user).toBeTruthy()
      })

      await act(async () => {
        await result.current.resendVerificationEmail()
      })

      expect(firebaseAuth.sendEmailVerification).toHaveBeenCalledWith(mockUser)
    })

    it('未ログイン時にエラーを返す', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(result.current.resendVerificationEmail()).rejects.toThrow(
        'ユーザーがログインしていません'
      )
    })

    it('送信回数制限エラーを処理する', async () => {
      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
      } as firebaseAuth.User

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0)
        return mockUnsubscribe
      })

      const error = { code: 'auth/too-many-requests', message: 'Too many requests' }
      ;(firebaseAuth.sendEmailVerification as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await waitFor(() => {
        expect(result.current.user).toBeTruthy()
      })

      await expect(result.current.resendVerificationEmail()).rejects.toThrow(
        '送信回数の上限に達しました。しばらくしてからお試しください。'
      )
    })
  })

  describe('signOut', () => {
    it('サインアウトが成功する', async () => {
      ;(firebaseAuth.signOut as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await act(async () => {
        await result.current.signOut()
      })

      expect(firebaseAuth.signOut).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/')
    })

    it('サインアウトエラーを処理する', async () => {
      const error = { code: 'auth/network-request-failed', message: 'Network error' }
      ;(firebaseAuth.signOut as jest.Mock).mockRejectedValue(error)

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      })

      await expect(result.current.signOut()).rejects.toThrow(
        'ネットワークエラーが発生しました。接続を確認してください。'
      )
    })
  })

  describe('ルーティング動作', () => {
    it('サインインページでユーザーがログインしたらダッシュボードへリダイレクト', async () => {
      window.location.pathname = '/signin'

      const mockUser = {
        uid: 'test-uid',
        email: 'test@example.com',
        providerData: [],
        emailVerified: false,
        isAnonymous: false,
        metadata: {},
        refreshToken: '',
        tenantId: null,
        delete: jest.fn(),
        getIdToken: jest.fn(),
        getIdTokenResult: jest.fn(),
        reload: jest.fn(),
        toJSON: jest.fn(),
        displayName: null,
        photoURL: null,
        phoneNumber: null,
        providerId: 'firebase',
      } as firebaseAuth.User

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 0)
        return mockUnsubscribe
      })

      renderHook(() => useAuth(), { wrapper: AuthProvider })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('ダッシュボードでユーザーがログアウトしたらサインインページへリダイレクト', async () => {
      window.location.pathname = '/dashboard'

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(null), 0)
        return mockUnsubscribe
      })

      renderHook(() => useAuth(), { wrapper: AuthProvider })

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/signin')
      })
    })
  })

  describe('useAuth フック', () => {
    it('AuthProvider外で使用するとエラーをスロー', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleSpy.mockRestore()
    })
  })
})