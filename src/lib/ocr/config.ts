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

/** Production ThinkStation GB10. Not Modal/RunPod. Do not default to :8090. */
export const PRODUCTION_VLM_URL = "http://100.93.32.70:8092/v1";
export const PRODUCTION_PPOCR_URL = "http://100.93.32.70:8093";
export const PRODUCTION_VLM_LAN_URL = "http://192.168.11.26:8092/v1";
export const PRODUCTION_PPOCR_LAN_URL = "http://192.168.11.26:8093";

/** Laptop mock sidecar only. Never use this port in production. */
export const LOCAL_DEV_AGGREGATOR_URL = "http://127.0.0.1:8090";

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
  return (process.env.OCR_VLM_URL?.trim() || PRODUCTION_VLM_URL).replace(
    /\/$/,
    "",
  );
}

export function getPpocrUrl(): string {
  return (process.env.OCR_PPOCR_URL?.trim() || PRODUCTION_PPOCR_URL).replace(
    /\/$/,
    "",
  );
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
