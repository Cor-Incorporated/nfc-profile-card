/**
 * Business-card OCR orchestrator.
 * Default path: local dual pipeline (PP-OCRv6 + PaddleOCR-VL).
 * Gemini is last-resort only (OCR_PROVIDER=gemini or OCR_ENABLE_GEMINI_FALLBACK).
 */

import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import {
  extractionToContactInfo,
  getInferenceMode,
  getOcrProvider,
  isGeminiFallbackEnabled,
  mergeDualPipeline,
  reviewFieldsFromDecisions,
  type MergedCardExtraction,
} from "@/lib/ocr";
import { ocrLogger } from "@/lib/logger";
import { ContactInfo } from "@/types/business-card";
import { callInferenceService } from "./ocr/inferenceClient";
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
): Promise<OcrResult> {
  const startTime = Date.now();
  const raw =
    getInferenceMode() === "mock"
      ? createMockDualPipeline()
      : await callInferenceService(image, mimeType);

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
): Promise<OcrResult> {
  const geminiResult = await processWithGemini(image, mimeType);
  return {
    success: geminiResult.success,
    contactInfo: geminiResult.contactInfo,
    processingTime: geminiResult.processingTime,
    error: geminiResult.error,
    engine: "gemini",
    humanReview: true,
  };
}

export async function processBusinessCardImage(
  image: string,
  mimeType: string,
): Promise<OcrResult> {
  const startTime = Date.now();
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
    return processWithGeminiFallback(image, mimeType);
  }

  try {
    return await processWithLocalPipeline(image, mimeType);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ocrLogger.error("Local OCR pipeline failed:", message);

    if (isGeminiFallbackEnabled()) {
      ocrLogger.warn(
        "Falling back to Gemini because OCR_ENABLE_GEMINI_FALLBACK=true",
      );
      return processWithGeminiFallback(image, mimeType);
    }

    return {
      success: false,
      processingTime: Date.now() - startTime,
      error:
        "ローカルOCR推論サービスに接続できません。OCR_INFERENCE_URL を確認するか、services/ocr-inference を起動してください。",
    };
  }
}

export { processWithGemini };
