import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util'

// TextEncoderとTextDecoderの設定
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Jest DOMマッチャーの拡張
import { toBeDisabled, toBeInTheDocument, toHaveClass } from '@testing-library/jest-dom/matchers'
expect.extend({
  toBeInTheDocument,
  toHaveClass,
  toBeDisabled,
})

// グローバルなモックの設定
global.fetch = jest.fn()

// Requestオブジェクトのモック
global.Request = jest.fn().mockImplementation(() => ({}))

// Responseオブジェクトのモック
global.Response = jest.fn().mockImplementation(() => ({}))

// ReadableStreamのポリフィル
if (!global.ReadableStream) {
  global.ReadableStream = class ReadableStream {
    constructor() {}
    getReader() {
      return {
        read: jest.fn().mockResolvedValue({ done: true }),
        cancel: jest.fn(),
      }
    }
  }
}

// Next.js Routerのモック
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      refresh: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      prefetch: jest.fn(),
      route: '/',
      pathname: '',
      query: '',
      asPath: '',
    }
  },
  useSearchParams() {
    return {
      get: jest.fn(),
    }
  },
  usePathname() {
    return '/'
  },
}))

// Firebase のモック
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}))

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  GithubAuthProvider: jest.fn(),
}))

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  onSnapshot: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date() })),
    fromDate: jest.fn((date) => ({ toDate: () => date })),
  },
}))

// 環境変数のモック
process.env = {
  ...process.env,
  NEXT_PUBLIC_FIREBASE_API_KEY: 'test-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'test-project-id',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-storage-bucket',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: 'test-sender-id',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'test-app-id',
}