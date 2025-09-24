/**
 * Business Card Scan Error Messages
 * Centralized error message constants for internationalization
 */

export const ERROR_MESSAGES = {
  // Authentication Errors
  AUTH_REQUIRED: "Authentication required",
  AUTH_INVALID_TOKEN: "Invalid authentication token",
  AUTH_LOGIN_REQUIRED: "認証エラー: ログインしてください",

  // Image Processing Errors
  IMAGE_REQUIRED: "Image and mimeType are required",
  IMAGE_PROCESSING_FAILED: "Failed to process business card",
  IMAGE_READ_FAILED: "画像の読み込みに失敗しました。",

  // OCR Processing Errors
  OCR_EXTRACTION_FAILED:
    "情報の抽出に失敗しました。画像の向きを変えたり、明るい場所で再撮影したりすると改善する場合があります。",
  OCR_TIMEOUT: "Timeout: OCR処理が10秒を超えました",
  OCR_PARSING_FAILED: "Failed to parse OCR response",
  OCR_UNSUPPORTED_FORMAT: "サポートされていない画像形式です。JPEG、PNG、WebP、GIF、HEIC形式をご利用ください。",

  // VCard Generation Errors
  VCARD_GENERATION_FAILED: "vCardファイルの生成に失敗しました。",

  // Quota Errors
  QUOTA_EXCEEDED: "月間スキャン上限に達しました",
  QUOTA_CHECK_FAILED: "スキャン上限の確認に失敗しました",

  // Network Errors
  NETWORK_ERROR: "ネットワークエラーが発生しました",
  SERVER_ERROR: "サーバーエラーが発生しました",

  // Generic Errors
  UNKNOWN_ERROR: "不明なエラーが発生しました",
  INVALID_REQUEST: "Invalid request format",
} as const;

export const SUCCESS_MESSAGES = {
  // OCR Success
  OCR_SUCCESS: "名刺の情報を抽出しました",
  OCR_SUCCESS_WITH_TIME: (seconds: string) =>
    `名刺の情報を抽出しました（${seconds}秒）`,

  // VCard Success
  VCARD_DOWNLOAD_SUCCESS: "vCardファイルをダウンロードしました",

  // General Success
  OPERATION_SUCCESS: "処理が完了しました",
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
export type SuccessMessageKey = keyof typeof SUCCESS_MESSAGES;
