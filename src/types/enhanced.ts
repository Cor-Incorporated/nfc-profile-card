import { z } from 'zod'
import { Timestamp } from 'firebase/firestore'

// Zodスキーマを使用した型安全な検証

// メールアドレスの検証
export const EmailSchema = z.string().email('有効なメールアドレスを入力してください')

// URLの検証
export const UrlSchema = z.string().url('有効なURLを入力してください')

// ユーザー名の検証（英数字とハイフン、アンダースコアのみ）
export const UsernameSchema = z
  .string()
  .min(3, 'ユーザー名は3文字以上にしてください')
  .max(30, 'ユーザー名は30文字以下にしてください')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'ユーザー名は英数字、ハイフン、アンダースコアのみ使用できます'
  )

// パスワードの検証
export const PasswordSchema = z
  .string()
  .min(8, 'パスワードは8文字以上にしてください')
  .max(100, 'パスワードは100文字以下にしてください')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    'パスワードは大文字、小文字、数字を含む必要があります'
  )

// プロフィールリンクのスキーマ
export const ProfileLinkSchema = z.object({
  url: UrlSchema,
  label: z.string().max(50).optional(),
  service: z.string().optional(),
  icon: z.string().optional(),
  order: z.number().int().min(0),
})

// ユーザープロフィールのスキーマ
export const UserProfileSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100),
  company: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: UrlSchema.optional(),
  phone: z.string().regex(/^[\d-+().\s]+$/).max(30).optional(),
  website: UrlSchema.optional(),
  address: z.string().max(200).optional(),
  links: z.array(ProfileLinkSchema).max(10, 'リンクは最大10個まで追加できます'),
})

// サインアップフォームのスキーマ
export const SignUpFormSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  confirmPassword: z.string(),
  displayName: z.string().min(1).max(100).optional(),
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: '利用規約に同意する必要があります',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'パスワードが一致しません',
  path: ['confirmPassword'],
})

// サインインフォームのスキーマ
export const SignInFormSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'パスワードを入力してください'),
})

// プロフィール編集フォームのスキーマ
export const ProfileEditFormSchema = z.object({
  username: UsernameSchema,
  name: z.string().min(1, '名前を入力してください').max(100),
  company: z.string().max(100).optional().or(z.literal('')),
  position: z.string().max(100).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  email: EmailSchema.optional().or(z.literal('')),
  phone: z.string()
    .regex(/^[\d-+().\s]*$/, '有効な電話番号を入力してください')
    .max(30)
    .optional()
    .or(z.literal('')),
  website: z.union([UrlSchema, z.literal('')]).optional(),
  address: z.string().max(200).optional().or(z.literal('')),
})

// NFCカード追加フォームのスキーマ
export const AddNFCCardFormSchema = z.object({
  cardId: z.string()
    .min(1, 'カードIDを入力してください')
    .max(50)
    .regex(/^[A-Z0-9-]+$/, 'カードIDは大文字英数字とハイフンのみ使用できます'),
  nickname: z.string().max(50).optional(),
})

// 連絡先追加フォームのスキーマ
export const AddContactFormSchema = z.object({
  name: z.string().min(1, '名前を入力してください').max(100),
  company: z.string().max(100).optional(),
  title: z.string().max(100).optional(),
  email: EmailSchema.optional(),
  phone: z.string()
    .regex(/^[\d-+().\s]*$/)
    .max(30)
    .optional(),
  notes: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  event: z.string().max(100).optional(),
})

// 型定義のエクスポート
export type SignUpFormData = z.infer<typeof SignUpFormSchema>
export type SignInFormData = z.infer<typeof SignInFormSchema>
export type ProfileEditFormData = z.infer<typeof ProfileEditFormSchema>
export type AddNFCCardFormData = z.infer<typeof AddNFCCardFormSchema>
export type AddContactFormData = z.infer<typeof AddContactFormSchema>
export type UserProfileData = z.infer<typeof UserProfileSchema>
export type ProfileLinkData = z.infer<typeof ProfileLinkSchema>

// Firestore Timestamp変換ユーティリティ
export function convertTimestamp(timestamp: Timestamp | Date | undefined): Date | null {
  if (!timestamp) return null
  if (timestamp instanceof Date) return timestamp
  if (timestamp instanceof Timestamp) return timestamp.toDate()
  return null
}

// Firestore用のデータ変換
export function toFirestoreData<T extends Record<string, any>>(
  data: T
): T & { updatedAt: Timestamp } {
  return {
    ...data,
    updatedAt: Timestamp.now() as Timestamp,
  }
}

// APIレスポンス型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    version?: string
  }
}

// ページネーション型
export interface PaginationParams {
  page?: number
  limit?: number
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// 検索パラメータ型
export interface SearchParams {
  query: string
  filters?: Record<string, any>
  pagination?: PaginationParams
}

// 認証状態の型
export interface AuthState {
  isAuthenticated: boolean
  user: FirebaseUser | null
  loading: boolean
  error: string | null
}

// Firebase User型の拡張
export interface FirebaseUser {
  uid: string
  email: string | null
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  phoneNumber: string | null
  providerId: string
  metadata?: {
    creationTime?: string
    lastSignInTime?: string
  }
}

// アプリケーション設定型
export interface AppConfig {
  firebase: {
    apiKey: string
    authDomain: string
    projectId: string
    storageBucket: string
    messagingSenderId: string
    appId: string
    measurementId?: string
  }
  stripe: {
    publishableKey: string
  }
  gemini: {
    apiKey: string
  }
  app: {
    name: string
    url: string
    supportEmail: string
  }
  features: {
    enableOCR: boolean
    enablePayments: boolean
    enableAnalytics: boolean
    maxFreeLinks: number
    maxFreeCards: number
  }
}

// フィーチャーフラグ型
export interface FeatureFlags {
  [key: string]: boolean | string | number
}

// 通知型
export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message?: string
  timestamp: Date
  read: boolean
  actionUrl?: string
  actionLabel?: string
}

// アナリティクスイベント型
export interface AnalyticsEvent {
  name: string
  category: 'user' | 'profile' | 'nfc' | 'social' | 'system'
  properties?: Record<string, any>
  timestamp: Date
  userId?: string
  sessionId?: string
}