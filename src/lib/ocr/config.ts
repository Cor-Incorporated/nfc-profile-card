import type { InferenceMode, OcrProviderName, VlmEngine } from "./types";

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
  const parsed = Number(process.env.OCR_INFERENCE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25000;
}
