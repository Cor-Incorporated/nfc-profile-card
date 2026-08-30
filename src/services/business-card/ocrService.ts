/**
 * Business-card OCR orchestrator.
 * Default path: local dual pipeline (PP-OCRv6 + PaddleOCR-VL).
 * Gemini is last-resort only (OCR_PROVIDER=gemini or OCR_ENABLE_GEMINI_FALLBACK).
 */

import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  extractionToContactInfo,
  getGeminiFallbackTimeoutMs,
  getInferenceMode,
  getInferenceTimeoutMs,
  getOcrTotalTimeoutMs,
  getOcrProvider,
  isGeminiFallbackEnabled,
  mergeDualPipeline,
  reviewFieldsFromDecisions,
  type MergedCardExtraction,
} from "@/lib/ocr";
import { ocrLogger } from "@/lib/logger";
import { ContactInfo } from "@/types/business-card";
import {
  OcrInferenceError,
  callInferenceService,
  isTransientOcrInferenceError,
} from "./ocr/inferenceClient";
import { processWithGemini } from "./ocr/geminiProvider";
import { createMockDualPipeline } from "./ocr/mockInference";

const SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const GEMINI_DEADLINE_ERROR = "Gemini OCRがAPI制限時間内に完了しませんでした。";

class GeminiDeadlineError extends Error {
  constructor() {
    super(GEMINI_DEADLINE_ERROR);
    this.name = "GeminiDeadlineError";
  }
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new GeminiDeadlineError()),
      timeoutMs,
    );
    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export interface OcrResult {
  success: boolean;
  contactInfo?: ContactInfo;
  extraction?: MergedCardExtraction;
  humanReview?: boolean;
  engine?: string;
  fieldReviews?: Record<
    string,
    { human_review: boolean; confidence: number; reason?: string }
  >;
  processingTime: number;
  error?: string;
}

function validateImage(
  image: string,
  mimeType: string,
  startTime: number,
): OcrResult | null {
  const maxImageSize =
    mimeType === "image/heic" || mimeType === "image/heif"
      ? 8 * 1024 * 1024
      : 4 * 1024 * 1024;

  if (image.length > maxImageSize) {
    const maxSizeMB = maxImageSize / (1024 * 1024);
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: `画像サイズが大きすぎます。${maxSizeMB}MB以下の画像をご利用ください。`,
    };
  }

  if (!SUPPORTED_MIME_TYPES.includes(mimeType.toLowerCase())) {
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: ERROR_MESSAGES.OCR_UNSUPPORTED_FORMAT,
    };
  }

  return null;
}

async function processWithLocalPipeline(
  image: string,
  mimeType: string,
  startTime: number,
  timeoutMs: number,
): Promise<OcrResult> {
  if (timeoutMs <= 0) {
    throw new OcrInferenceError(
      "OCR inference timed out before dispatch",
      "timeout",
      true,
    );
  }
  const raw =
    getInferenceMode() === "mock"
      ? createMockDualPipeline()
      : await callInferenceService(image, mimeType, timeoutMs);

  const extraction = mergeDualPipeline(raw);
  const contactInfo = extractionToContactInfo(extraction);

  return {
    success: true,
    contactInfo,
    extraction,
    humanReview: extraction.human_review,
    engine: extraction.engine,
    fieldReviews: reviewFieldsFromDecisions(extraction.fields),
    processingTime: Date.now() - startTime,
  };
}

async function processWithGeminiFallback(
  image: string,
  mimeType: string,
  startTime: number,
  deadlineAtMs: number,
): Promise<OcrResult> {
  const timeoutMs = deadlineAtMs - Date.now();
  if (timeoutMs <= 0) {
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: GEMINI_DEADLINE_ERROR,
      engine: "gemini",
      humanReview: true,
    };
  }

  try {
    const geminiResult = await withTimeout(
      processWithGemini(image, mimeType, { deadlineAtMs }),
      timeoutMs,
    );
    return {
      success: geminiResult.success,
      contactInfo: geminiResult.contactInfo,
      processingTime: Date.now() - startTime,
      error: geminiResult.error,
      engine: "gemini",
      humanReview: true,
    };
  } catch (error) {
    return {
      success: false,
      processingTime: Date.now() - startTime,
      error:
        error instanceof GeminiDeadlineError
          ? GEMINI_DEADLINE_ERROR
          : "Gemini OCRの実行に失敗しました。",
      engine: "gemini",
      humanReview: true,
    };
  }
}

export async function processBusinessCardImage(
  image: string,
  mimeType: string,
  options: { deadlineAtMs?: number } = {},
): Promise<OcrResult> {
  const startTime = Date.now();
  const deadlineAtMs = Math.min(
    options.deadlineAtMs ?? Number.POSITIVE_INFINITY,
    startTime + getOcrTotalTimeoutMs(),
  );
  ocrLogger.debug("=== OCR Processing Started ===");
  ocrLogger.debug("Provider:", getOcrProvider());
  ocrLogger.debug("MIME Type:", mimeType);

  const validationError = validateImage(image, mimeType, startTime);
  if (validationError) {
    return validationError;
  }

  const provider = getOcrProvider();

  if (provider === "gemini") {
    ocrLogger.warn("Gemini OCR requested explicitly via OCR_PROVIDER=gemini");
    return processWithGeminiFallback(image, mimeType, startTime, deadlineAtMs);
  }

  try {
    const localTimeoutMs = Math.min(
      getInferenceTimeoutMs(),
      deadlineAtMs - Date.now(),
    );
    return await processWithLocalPipeline(
      image,
      mimeType,
      startTime,
      localTimeoutMs,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ocrLogger.error("Local OCR pipeline failed:", message);

    const transientFailure = isTransientOcrInferenceError(error);
    if (isGeminiFallbackEnabled() && transientFailure) {
      const fallbackDeadlineAtMs = Math.min(
        deadlineAtMs,
        Date.now() + getGeminiFallbackTimeoutMs(),
      );
      ocrLogger.warn(
        "Falling back to Gemini after a transient local OCR failure",
      );
      return processWithGeminiFallback(
        image,
        mimeType,
        startTime,
        fallbackDeadlineAtMs,
      );
    }

    if (isGeminiFallbackEnabled() && !transientFailure) {
      ocrLogger.warn(
        "Gemini fallback skipped for a permanent local OCR failure",
      );
    }

    return {
      success: false,
      processingTime: Date.now() - startTime,
      error: transientFailure
        ? "ローカルOCR推論サービスに接続できません。OCR_INFERENCE_URL を確認するか、services/ocr-inference を起動してください。"
        : "ローカルOCR推論の設定または応答が不正です。Geminiへの自動送信は行いませんでした。",
    };
  }
}

export { processWithGemini };
