import type { InferenceMode, OcrProviderName, VlmEngine } from "./types";

const API_ROUTE_MAX_DURATION_MS = 30000;
const API_DEADLINE_HEADROOM_MS = 2000;
const PIPELINE_HANDOFF_HEADROOM_MS = 1000;
const DEFAULT_TOTAL_TIMEOUT_MS =
  API_ROUTE_MAX_DURATION_MS - API_DEADLINE_HEADROOM_MS;
const DEFAULT_INFERENCE_TIMEOUT_MS = 25000;
const DEFAULT_GEMINI_FALLBACK_TIMEOUT_MS = 18000;
const MIN_LOCAL_FALLBACK_TIMEOUT_MS = 3000;

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Laptop mock sidecar only. Never use this port in production. */
export const LOCAL_DEV_AGGREGATOR_URL = "http://127.0.0.1:8090";

function requiredDirectEndpoint(name: "OCR_VLM_URL" | "OCR_PPOCR_URL") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `${name} is required only for an explicitly configured direct development path`,
    );
  }
  return value.replace(/\/$/, "");
}

export function getOcrProvider(): OcrProviderName {
  const value = process.env.OCR_PROVIDER?.trim().toLowerCase();
  return value === "gemini" ? "gemini" : "local";
}

export function isGeminiFallbackEnabled(): boolean {
  return process.env.OCR_ENABLE_GEMINI_FALLBACK === "true";
}

export function getInferenceBaseUrl(): string | undefined {
  const value = process.env.OCR_INFERENCE_URL?.trim();
  return value ? value.replace(/\/$/, "") : undefined;
}

export function getVlmUrl(): string {
  return requiredDirectEndpoint("OCR_VLM_URL");
}

export function getPpocrUrl(): string {
  return requiredDirectEndpoint("OCR_PPOCR_URL");
}

export function getInferenceApiKey(): string | undefined {
  return process.env.OCR_INFERENCE_API_KEY?.trim() || undefined;
}

export function getInferenceMode(): InferenceMode {
  const value = process.env.OCR_INFERENCE_MODE?.trim().toLowerCase();
  return value === "mock" ? "mock" : "live";
}

export function getVlmEngine(): VlmEngine {
  const value = process.env.OCR_VLM_ENGINE?.trim().toLowerCase();
  return value === "hunyuanocr-1.5" ? "hunyuanocr-1.5" : "paddleocr-vl-1.6";
}

export function getInferenceTimeoutMs(): number {
  const requested = positiveNumber(
    process.env.OCR_INFERENCE_TIMEOUT_MS,
    DEFAULT_INFERENCE_TIMEOUT_MS,
  );
  const totalBudget = getOcrTotalTimeoutMs();

  if (!isGeminiFallbackEnabled()) {
    return Math.min(requested, totalBudget);
  }

  const localBudget = Math.max(
    1,
    totalBudget - getGeminiFallbackTimeoutMs() - PIPELINE_HANDOFF_HEADROOM_MS,
  );
  const timeoutMs = Math.min(requested, localBudget);
  if (timeoutMs < MIN_LOCAL_FALLBACK_TIMEOUT_MS) {
    throw new Error(
      `OCR timeout configuration must leave at least ${MIN_LOCAL_FALLBACK_TIMEOUT_MS}ms for local inference`,
    );
  }
  return timeoutMs;
}

export function getOcrTotalTimeoutMs(): number {
  const requested = positiveNumber(
    process.env.OCR_TOTAL_TIMEOUT_MS,
    DEFAULT_TOTAL_TIMEOUT_MS,
  );
  return Math.min(requested, DEFAULT_TOTAL_TIMEOUT_MS);
}

export function getGeminiFallbackTimeoutMs(): number {
  const requested = positiveNumber(
    process.env.OCR_GEMINI_FALLBACK_TIMEOUT_MS,
    DEFAULT_GEMINI_FALLBACK_TIMEOUT_MS,
  );
  return Math.min(
    requested,
    Math.max(1, getOcrTotalTimeoutMs() - PIPELINE_HANDOFF_HEADROOM_MS),
  );
}
