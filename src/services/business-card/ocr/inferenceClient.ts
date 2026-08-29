import {
  getInferenceApiKey,
  getInferenceBaseUrl,
  getInferenceTimeoutMs,
  getVlmEngine,
} from "@/lib/ocr/config";
import type { DualPipelineRaw, VlmEngine } from "@/lib/ocr/types";
import { ocrLogger } from "@/lib/logger";

export interface InferenceRequest {
  image: string;
  mimeType: string;
  vlmEngine: VlmEngine;
}

function stripDataUrl(image: string): string {
  return image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
}

function isDualPipelineRaw(value: unknown): value is DualPipelineRaw {
  if (!value || typeof value !== "object") return false;
  const candidate = value as DualPipelineRaw;
  return (
    typeof candidate.classic?.rawText === "string" &&
    Array.isArray(candidate.classic.blocks) &&
    typeof candidate.semantic?.fields === "object"
  );
}

export async function callInferenceService(
  image: string,
  mimeType: string,
): Promise<DualPipelineRaw> {
  const baseUrl = getInferenceBaseUrl();
  const timeoutMs = getInferenceTimeoutMs();
  const apiKey = getInferenceApiKey();
  const vlmEngine = getVlmEngine();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    ocrLogger.info("Calling local OCR inference service", baseUrl, vlmEngine);

    const response = await fetch(`${baseUrl}/v1/ocr/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        image: stripDataUrl(image),
        mimeType,
        vlmEngine,
      } satisfies InferenceRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OCR inference service returned ${response.status}: ${detail.slice(0, 200)}`,
      );
    }

    const payload = (await response.json()) as
      | { data?: unknown }
      | DualPipelineRaw;
    const data =
      payload && typeof payload === "object" && "data" in payload
        ? payload.data
        : payload;

    if (!isDualPipelineRaw(data)) {
      throw new Error("OCR inference service returned an unexpected payload");
    }

    return data;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("OCR inference service timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
