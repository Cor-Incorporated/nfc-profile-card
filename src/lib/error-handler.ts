import { AuthError } from 'firebase/auth'
import { FirestoreError } from 'firebase/firestore'

// カスタムエラークラス
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// エラーコード定義
export const ErrorCodes = {
  // 認証関連
  AUTH_INVALID_EMAIL: 'AUTH_INVALID_EMAIL',
  AUTH_USER_DISABLED: 'AUTH_USER_DISABLED',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  AUTH_WRONG_PASSWORD: 'AUTH_WRONG_PASSWORD',
  AUTH_EMAIL_ALREADY_IN_USE: 'AUTH_EMAIL_ALREADY_IN_USE',
  AUTH_WEAK_PASSWORD: 'AUTH_WEAK_PASSWORD',
  AUTH_OPERATION_NOT_ALLOWED: 'AUTH_OPERATION_NOT_ALLOWED',
  AUTH_POPUP_BLOCKED: 'AUTH_POPUP_BLOCKED',
  AUTH_INVALID_CREDENTIAL: 'AUTH_INVALID_CREDENTIAL',
  AUTH_NETWORK_REQUEST_FAILED: 'AUTH_NETWORK_REQUEST_FAILED',
  AUTH_TOO_MANY_REQUESTS: 'AUTH_TOO_MANY_REQUESTS',
  AUTH_MISSING_PASSWORD: 'AUTH_MISSING_PASSWORD',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // データベース関連
  DB_NOT_FOUND: 'DB_NOT_FOUND',
  DB_PERMISSION_DENIED: 'DB_PERMISSION_DENIED',
  DB_UNAVAILABLE: 'DB_UNAVAILABLE',
  DB_ALREADY_EXISTS: 'DB_ALREADY_EXISTS',
  DB_INVALID_DATA: 'DB_INVALID_DATA',
  DB_QUOTA_EXCEEDED: 'DB_QUOTA_EXCEEDED',

  // バリデーション関連
  VALIDATION_INVALID_EMAIL: 'VALIDATION_INVALID_EMAIL',
  VALIDATION_INVALID_USERNAME: 'VALIDATION_INVALID_USERNAME',
  VALIDATION_INVALID_URL: 'VALIDATION_INVALID_URL',
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_MAX_LENGTH: 'VALIDATION_MAX_LENGTH',
  VALIDATION_MIN_LENGTH: 'VALIDATION_MIN_LENGTH',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',

  // ビジネスロジック関連
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  CARD_ALREADY_REGISTERED: 'CARD_ALREADY_REGISTERED',
  SUBSCRIPTION_EXPIRED: 'SUBSCRIPTION_EXPIRED',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',

  // ネットワーク関連
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // その他
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// Firebase Authエラーをアプリエラーに変換
export function handleFirebaseAuthError(error: AuthError): AppError {
  const errorMap: Record<string, { code: ErrorCode; message: string; statusCode: number }> = {
    'auth/invalid-email': {
      code: ErrorCodes.AUTH_INVALID_EMAIL,
      message: 'メールアドレスの形式が正しくありません。',
      statusCode: 400,
    },
    'auth/user-disabled': {
      code: ErrorCodes.AUTH_USER_DISABLED,
      message: 'このアカウントは無効化されています。',
      statusCode: 403,
    },
    'auth/user-not-found': {
      code: ErrorCodes.AUTH_USER_NOT_FOUND,
      message: 'アカウントが見つかりません。新規登録をお試しください。',
      statusCode: 404,
    },
    'auth/wrong-password': {
      code: ErrorCodes.AUTH_WRONG_PASSWORD,
      message: 'パスワードが間違っています。',
      statusCode: 401,
    },
    'auth/email-already-in-use': {
      code: ErrorCodes.AUTH_EMAIL_ALREADY_IN_USE,
      message: 'このメールアドレスは既に使用されています。',
      statusCode: 409,
    },
    'auth/weak-password': {
      code: ErrorCodes.AUTH_WEAK_PASSWORD,
      message: 'パスワードは6文字以上にしてください。',
      statusCode: 400,
    },
    'auth/operation-not-allowed': {
      code: ErrorCodes.AUTH_OPERATION_NOT_ALLOWED,
      message: 'このログイン方法は現在利用できません。',
      statusCode: 403,
    },
    'auth/popup-blocked': {
      code: ErrorCodes.AUTH_POPUP_BLOCKED,
      message: 'ポップアップがブロックされました。ブラウザの設定を確認してください。',
      statusCode: 400,
    },
    'auth/popup-closed-by-user': {
      code: ErrorCodes.AUTH_POPUP_BLOCKED,
      message: 'ログインがキャンセルされました。',
      statusCode: 400,
    },
    'auth/invalid-credential': {
      code: ErrorCodes.AUTH_INVALID_CREDENTIAL,
      message: 'メールアドレスまたはパスワードが間違っています。',
      statusCode: 401,
    },
    'auth/network-request-failed': {
      code: ErrorCodes.AUTH_NETWORK_REQUEST_FAILED,
      message: 'ネットワークエラーが発生しました。接続を確認してください。',
      statusCode: 503,
    },
    'auth/too-many-requests': {
      code: ErrorCodes.AUTH_TOO_MANY_REQUESTS,
      message: 'ログイン試行回数が多すぎます。しばらくしてからお試しください。',
      statusCode: 429,
    },
    'auth/missing-password': {
      code: ErrorCodes.AUTH_MISSING_PASSWORD,
      message: 'パスワードを入力してください。',
      statusCode: 400,
    },
  }

  const mappedError = errorMap[error.code]
  if (mappedError) {
    return new AppError(mappedError.code, mappedError.message, mappedError.statusCode)
  }

  return new AppError(
    ErrorCodes.UNKNOWN_ERROR,
    `認証エラーが発生しました: ${error.message}`,
    500,
    { originalError: error }
  )
}

// Firebase Firestoreエラーをアプリエラーに変換
export function handleFirestoreError(error: FirestoreError): AppError {
  const errorMap: Record<string, { code: ErrorCode; message: string; statusCode: number }> = {
    'not-found': {
      code: ErrorCodes.DB_NOT_FOUND,
      message: 'データが見つかりません。',
      statusCode: 404,
    },
    'permission-denied': {
      code: ErrorCodes.DB_PERMISSION_DENIED,
      message: 'アクセス権限がありません。',
      statusCode: 403,
    },
    'unavailable': {
      code: ErrorCodes.DB_UNAVAILABLE,
      message: 'サービスが一時的に利用できません。',
      statusCode: 503,
    },
    'already-exists': {
      code: ErrorCodes.DB_ALREADY_EXISTS,
      message: 'データは既に存在します。',
      statusCode: 409,
    },
    'invalid-argument': {
      code: ErrorCodes.DB_INVALID_DATA,
      message: '無効なデータです。',
      statusCode: 400,
    },
    'resource-exhausted': {
      code: ErrorCodes.DB_QUOTA_EXCEEDED,
      message: '利用制限に達しました。',
      statusCode: 429,
    },
  }

  const mappedError = errorMap[error.code]
  if (mappedError) {
    return new AppError(mappedError.code, mappedError.message, mappedError.statusCode)
  }

  return new AppError(
    ErrorCodes.UNKNOWN_ERROR,
    `データベースエラーが発生しました: ${error.message}`,
    500,
    { originalError: error }
  )
}

// 汎用的なエラーハンドラー
export function handleError(error: unknown): AppError {
  // 既にAppErrorの場合はそのまま返す
  if (error instanceof AppError) {
    return error
  }

  // Firebase Authエラーの場合
  if (error && typeof error === 'object' && 'code' in error) {
    const errorCode = (error as any).code
    if (typeof errorCode === 'string' && errorCode.startsWith('auth/')) {
      return handleFirebaseAuthError(error as AuthError)
    }
  }

  // Firestoreエラーの場合
  if (error && typeof error === 'object' && 'code' in error) {
    const errorCode = (error as any).code
    if (typeof errorCode === 'string' && !errorCode.includes('/')) {
      return handleFirestoreError(error as FirestoreError)
    }
  }

  // ネットワークエラーの場合
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return new AppError(
      ErrorCodes.NETWORK_ERROR,
      'ネットワークエラーが発生しました。',
      503
    )
  }

  // その他のエラー
  const message = error instanceof Error ? error.message : '予期しないエラーが発生しました。'
  return new AppError(ErrorCodes.UNKNOWN_ERROR, message, 500, { originalError: error })
}

// エラーロギング
export function logError(error: AppError, context?: Record<string, any>): void {
  const errorLog = {
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    context,
    stack: error.stack,
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('Error Log:', errorLog)
  } else {
    // 本番環境では外部エラートラッキングサービスに送信
    // 例: Sentry, LogRocket, etc.
    console.error(`[${error.code}] ${error.message}`)
  }
}

// エラーレスポンスの生成
export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

export function createErrorResponse(error: AppError): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
    },
    timestamp: new Date().toISOString(),
  }
}