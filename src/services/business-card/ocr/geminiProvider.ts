/**
 * Last-resort Gemini OCR provider.
 * Not used on the default scan path. Enable only with OCR_PROVIDER=gemini
 * or OCR_ENABLE_GEMINI_FALLBACK=true.
 */

import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { ocrLogger } from "@/lib/logger";
import { ContactInfo } from "@/types/business-card";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateContentResult, Part } from "@google/generative-ai";
import { z } from "zod";

// Initialize Gemini AI with API key from environment
// Use empty string as fallback to avoid build-time errors
// Actual validation happens at runtime in processBusinessCardImage
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash";

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const contactTextSchema = z
  .string()
  .max(1000)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value));
const contactInfoSchema = z
  .object({
    lastName: contactTextSchema,
    firstName: contactTextSchema,
    phoneticLastName: contactTextSchema,
    phoneticFirstName: contactTextSchema,
    company: contactTextSchema,
    department: contactTextSchema,
    title: contactTextSchema,
    addresses: z
      .array(
        z
          .object({
            label: contactTextSchema,
            postalCode: contactTextSchema,
            address: contactTextSchema,
          })
          .strict(),
      )
      .max(10),
    email: contactTextSchema,
    website: contactTextSchema,
    phoneNumbers: z
      .array(
        z
          .object({
            type: z.enum(["WORK", "MOBILE", "FAX", "OTHER"]),
            number: contactTextSchema,
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

// Optimized OCR prompt for Japanese business cards
const OCR_PROMPT = `
あなたは最先端のAI OCRシステムです。名刺画像から情報を高精度で抽出してください。

【優先順位】
1. 氏名（姓と名を正確に分割）
2. 会社名・部署名（完全な正式名称）
3. メールアドレス（typoを防ぐため慎重に）
4. 電話番号（種別を自動判定）
5. 住所情報

【特に注意すべき点】
- 日本語の縦書きレイアウトの正確な読み取り
- デザイン性の高い名刺のテキスト配置理解
- 手書き文字がある場合の認識
- ロゴマークと文字の区別
- 姓と名の区切り位置（スペースがなくても文脈で判断）

【抽出原則】
- 画像上に明確に表示されている情報のみ抽出してください
- メールアドレスのローカル部やドメイン名から、氏名・会社名・部署名・役職を推測してはいけません
- 推測できそうでも、画像上に文字として存在しない項目は空文字列にしてください
- 会社ロゴやメールドメインは、会社名の根拠として使わないでください

【電話番号の自動分類ルール】
- 携帯/Mobile: 070, 080, 090, 050で始まる
- FAX: FAX, Fax, ファックスの記載がある、または03等で始まり2番目の番号
- WORK: 上記以外、または03, 06, 052等の市外局番

【メールアドレスの検証】
- @マークの前後を慎重に確認
- よくあるドメイン: gmail.com, yahoo.co.jp, outlook.jp等
- 企業ドメインから会社名を補完しない

【出力形式】
必ず以下のキーを持つJSONオブジェクトを返してください：
{
  "lastName": "姓",
  "firstName": "名",
  "phoneticLastName": "姓のふりがなまたはローマ字",
  "phoneticFirstName": "名のふりがなまたはローマ字",
  "company": "会社名",
  "department": "部署名",
  "title": "役職",
  "addresses": [{ "label": "種類", "postalCode": "郵便番号", "address": "住所" }],
  "email": "メールアドレス",
  "website": "URL",
  "phoneNumbers": [{ "type": "WORK|MOBILE|FAX|OTHER", "number": "電話番号" }]
}

読み取れない項目は空文字列""または空配列[]にしてください。

重要:
- 出力は純粋なJSONのみ（マークダウンのコードブロックは含めない）
- 説明文、コメント、その他のテキストは一切含めない
- 必ず上記の形式のJSONオブジェクトを出力する
- JSONの前後に余分な文字列を付けないでください
- 必ず有効なJSON形式で応答してください
`;

export interface OcrResult {
  success: boolean;
  contactInfo?: ContactInfo;
  processingTime: number;
  error?: string;
}

function getPrimaryGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function getFallbackGeminiModel(primaryModel: string) {
  const fallbackModel =
    process.env.GEMINI_FALLBACK_MODEL?.trim() || DEFAULT_GEMINI_FALLBACK_MODEL;
  return fallbackModel === primaryModel ? null : fallbackModel;
}

function isModelAvailabilityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message;
  const referencesModel = /\bmodels\/[\w.-]+/i.test(message);
  const modelNotFound =
    /\[404[^\]]*\]/i.test(message) && /\bnot found\b/i.test(message);
  const modelMethodUnsupported = /\bis not supported for\b/i.test(message);

  return referencesModel && (modelNotFound || modelMethodUnsupported);
}

type GeminiFailureCode =
  | "api_key"
  | "deadline"
  | "quota"
  | "response_format"
  | "unknown";

function classifyGeminiFailure(
  error: unknown,
  mimeType: string,
): { code: GeminiFailureCode; publicMessage: string } {
  const message = error instanceof Error ? error.message : "";

  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "GeminiDeadlineError")
  ) {
    return {
      code: "deadline",
      publicMessage:
        "処理に時間がかかりすぎています。画像を再撮影してお試しください。",
    };
  }
  if (message.includes("API key") || message.includes("API_KEY_INVALID")) {
    return {
      code: "api_key",
      publicMessage: "OCR APIキーが無効です。管理者にお問い合わせください。",
    };
  }
  if (message.includes("timeout") || message.includes("DEADLINE_EXCEEDED")) {
    return {
      code: "deadline",
      publicMessage:
        "処理に時間がかかりすぎています。画像を再撮影してお試しください。",
    };
  }
  if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
    return {
      code: "quota",
      publicMessage: ERROR_MESSAGES.QUOTA_EXCEEDED,
    };
  }
  if (
    message.includes("The string did not match the expected pattern") &&
    (mimeType === "image/heic" || mimeType === "image/heif")
  ) {
    return {
      code: "response_format",
      publicMessage:
        "HEIC形式の画像でエラーが発生しました。JPEGまたはPNG形式で撮影し直してください。",
    };
  }
  if (
    message.includes("The string did not match the expected pattern") ||
    message.includes("Unexpected token") ||
    message.includes("not valid JSON")
  ) {
    return {
      code: "response_format",
      publicMessage: "OCR APIからの応答形式が不正です。再度お試しください。",
    };
  }
  return {
    code: "unknown",
    publicMessage: ERROR_MESSAGES.UNKNOWN_ERROR,
  };
}

function parseContactInfo(text: string): ContactInfo | null {
  const jsonText = text.trim();
  if (!jsonText.startsWith("{") || !jsonText.endsWith("}")) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const validated = contactInfoSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export interface GeminiExecutionOptions {
  deadlineAtMs?: number;
}

class GeminiDeadlineError extends Error {
  constructor() {
    super("Gemini OCR deadline exceeded");
    this.name = "GeminiDeadlineError";
  }
}

function remainingTimeoutMs(deadlineAtMs: number | undefined) {
  if (deadlineAtMs === undefined) return undefined;
  const remaining = deadlineAtMs - Date.now();
  if (remaining <= 0) throw new GeminiDeadlineError();
  return remaining;
}

async function generateOcrContent(
  modelName: string,
  imagePart: Part,
  deadlineAtMs: number | undefined,
) {
  const timeoutMs = remainingTimeoutMs(deadlineAtMs);
  const model = genAI.getGenerativeModel({ model: modelName });
  const controller =
    timeoutMs === undefined ? undefined : new AbortController();
  const timer =
    timeoutMs === undefined
      ? undefined
      : setTimeout(() => controller?.abort(), timeoutMs);

  try {
    return await model.generateContent(
      {
        contents: [
          {
            role: "user",
            parts: [imagePart, { text: OCR_PROMPT }],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      },
      timeoutMs === undefined
        ? undefined
        : { timeout: timeoutMs, signal: controller?.signal },
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Process business card image using Google Gemini API
 * @param image Base64 encoded image data
 * @param mimeType MIME type of the image
 * @returns OCR processing result
 */
export async function processWithGemini(
  image: string,
  mimeType: string,
  options: GeminiExecutionOptions = {},
): Promise<OcrResult> {
  const startTime = Date.now();

  // Log request info for debugging
  ocrLogger.debug("=== OCR Processing Started ===");
  ocrLogger.debug("Timestamp:", new Date().toISOString());
  ocrLogger.debug("MIME Type:", mimeType);
  ocrLogger.debug("Image size (base64):", image.length, "characters");

  // Check image size to prevent Request Entity errors
  // HEIC images are typically larger, so we allow up to 8MB for HEIC format
  const maxImageSize =
    mimeType === "image/heic" || mimeType === "image/heif"
      ? 8 * 1024 * 1024 // 8MB for HEIC
      : 4 * 1024 * 1024; // 4MB for other formats

  if (image.length > maxImageSize) {
    ocrLogger.error(
      "❌ Image too large:",
      image.length,
      "characters (max:",
      maxImageSize,
      ")",
    );
    const maxSizeMB = maxImageSize / (1024 * 1024);
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: `画像サイズが大きすぎます。${maxSizeMB}MB以下の画像をご利用ください。`,
    };
  }

  // Check for supported image formats (including HEIC)
  const supportedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
  ];

  // Check if MIME type is supported
  if (!supportedMimeTypes.includes(mimeType.toLowerCase())) {
    ocrLogger.warn("⚠️ Unsupported MIME type:", mimeType);
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: `サポートされていない画像形式です: ${mimeType}。JPEG、PNG、WebP、GIF、HEIC形式をご利用ください。`,
    };
  }

  // Log HEIC format detection for monitoring
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    ocrLogger.info("📱 HEIC format detected from mobile device");
    ocrLogger.debug("Configured Gemini model should support HEIC format");
    ocrLogger.debug("HEIC image size:", Math.round(image.length / 1024), "KB");
  }

  try {
    // Check API key at runtime
    if (!process.env.GEMINI_API_KEY) {
      ocrLogger.error(
        "❌ GEMINI_API_KEY is missing from environment variables",
      );
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "OCR service is not properly configured. API key is missing.",
      };
    }
    ocrLogger.debug("✅ Starting OCR processing");

    // Remove data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, "");
    ocrLogger.debug(
      "Base64 image size (cleaned):",
      base64Image.length,
      "characters",
    );

    // Use more robust API call format with explicit content structure
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: mimeType,
      },
    };

    const primaryModelName = getPrimaryGeminiModel();
    const fallbackModelName = getFallbackGeminiModel(primaryModelName);
    let result: GenerateContentResult;

    try {
      ocrLogger.info("Calling Gemini API with model:", primaryModelName);
      result = await generateOcrContent(
        primaryModelName,
        imagePart,
        options.deadlineAtMs,
      );
    } catch (primaryError) {
      if (!fallbackModelName || !isModelAvailabilityError(primaryError)) {
        throw primaryError;
      }

      ocrLogger.warn(
        "Primary Gemini model failed; retrying with fallback model:",
        fallbackModelName,
      );
      ocrLogger.warn("Primary Gemini failure category: model_unavailable");
      result = await generateOcrContent(
        fallbackModelName,
        imagePart,
        options.deadlineAtMs,
      );
    }

    if (!result || !result.response) {
      ocrLogger.error("❌ No response from Gemini API");
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "No response from Gemini API",
      };
    }

    const response = result.response;
    let text: string;
    try {
      text = response.text();
      ocrLogger.debug("✅ Got text from Gemini response");

      // Check for empty response
      if (!text || text.trim() === "") {
        ocrLogger.error("❌ Gemini returned empty response");
        return {
          success: false,
          processingTime: Date.now() - startTime,
          error:
            "OCR APIから空の応答が返されました。画像が読み取れなかった可能性があります。",
        };
      }
    } catch {
      ocrLogger.error("❌ Gemini response text extraction failed", {
        code: "response_text_unavailable",
      });
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error: "Failed to extract text from OCR response",
      };
    }

    // Calculate processing time
    const processingTime = Date.now() - startTime;
    ocrLogger.debug(`⏱️ OCR processing completed in ${processingTime}ms`);
    ocrLogger.debug("Response length:", text.length);
    const contactInfo = parseContactInfo(text);
    if (!contactInfo) {
      ocrLogger.error("❌ Gemini response failed strict schema validation", {
        code: "invalid_response_schema",
        responseLength: text.length,
      });
      return {
        success: false,
        processingTime: Date.now() - startTime,
        error:
          "OCR応答の解析に失敗しました。しばらく時間をおいてから再試行してください。",
      };
    }

    return {
      success: true,
      contactInfo,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const failure = classifyGeminiFailure(error, mimeType);
    ocrLogger.error("❌ Gemini OCR request failed", { code: failure.code });

    ocrLogger.info("=== OCR Processing Failed ===");
    ocrLogger.info(`Processing time: ${processingTime}ms`);

    return {
      success: false,
      processingTime,
      error: failure.publicMessage,
    };
  }
}
