import {
  getInferenceApiKey,
  getInferenceBaseUrl,
  getInferenceTimeoutMs,
  getPpocrUrl,
  getVlmEngine,
  getVlmUrl,
} from "@/lib/ocr/config";
import type {
  ClassicOcrResult,
  DualPipelineRaw,
  SemanticCardFields,
  SemanticExtraction,
} from "@/lib/ocr/types";
import { CARD_FIELDS } from "@/lib/ocr/types";
import { ocrLogger } from "@/lib/logger";

export interface InferenceRequest {
  model: "nfc-ocr";
  image: string;
  mimeType: string;
}

export type OcrInferenceErrorKind =
  | "configuration"
  | "timeout"
  | "network"
  | "unavailable"
  | "http"
  | "unsupported_input"
  | "invalid_response";

export class OcrInferenceError extends Error {
  constructor(
    message: string,
    readonly kind: OcrInferenceErrorKind,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OcrInferenceError";
  }
}

export function isTransientOcrInferenceError(error: unknown): boolean {
  return error instanceof OcrInferenceError && error.retryable;
}

const NETWORK_ERROR_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);

function hasNetworkErrorCode(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const record = value as {
    cause?: unknown;
    code?: unknown;
    errors?: unknown;
  };
  if (typeof record.code === "string" && NETWORK_ERROR_CODES.has(record.code)) {
    return true;
  }
  if (Array.isArray(record.errors) && record.errors.some(hasNetworkErrorCode)) {
    return true;
  }
  return hasNetworkErrorCode(record.cause);
}

const SEMANTIC_PROMPT = `Extract business-card fields as JSON only.
Keys: name, name_kana, company, department, title, email, phone, mobile, fax, postal_code, address, url, social.
Associate name / company / title from layout. Do not invent email, phone, URL, or postal_code if they are not visible. Empty string if unseen.`;
const OCR_GATEWAY_MODEL = "nfc-ocr" as const;
const OCR_GATEWAY_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

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

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  let endpoint: URL;
  try {
    endpoint = new URL(url);
  } catch {
    throw new OcrInferenceError(
      "OCR inference endpoint is invalid",
      "configuration",
      false,
    );
  }
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new OcrInferenceError(
      "OCR inference endpoint must use HTTP or HTTPS",
      "configuration",
      false,
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      ...init,
      signal: controller.signal,
    });
    if (!response.ok) {
      const retryable = [408, 429, 500, 502, 503, 504].includes(
        response.status,
      );
      throw new OcrInferenceError(
        `OCR inference returned HTTP ${response.status}`,
        retryable ? "unavailable" : "http",
        retryable,
        response.status,
      );
    }
    try {
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      throw new OcrInferenceError(
        "OCR inference returned invalid JSON",
        "invalid_response",
        false,
      );
    }
  } catch (error) {
    if (error instanceof OcrInferenceError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OcrInferenceError("OCR inference timed out", "timeout", true);
    }
    if (error instanceof TypeError) {
      if (!hasNetworkErrorCode(error)) {
        throw new OcrInferenceError(
          "OCR inference request configuration is invalid",
          "configuration",
          false,
        );
      }
      throw new OcrInferenceError(
        "OCR inference network request failed",
        "network",
        true,
      );
    }
    throw new OcrInferenceError("OCR inference request failed", "http", false);
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = getInferenceApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

function authenticatedGatewayHeaders(): Record<string, string> {
  const apiKey = getInferenceApiKey();
  if (!apiKey) {
    throw new OcrInferenceError(
      "OCR gateway token is not configured",
      "configuration",
      false,
    );
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

function assertSecureGatewayUrl(baseUrl: string): URL {
  let endpoint: URL;
  try {
    endpoint = new URL(baseUrl);
  } catch {
    throw new OcrInferenceError(
      "OCR gateway endpoint is invalid",
      "configuration",
      false,
    );
  }
  const loopbackHosts = new Set(["127.0.0.1", "::1", "localhost"]);
  if (endpoint.protocol !== "https:" && !loopbackHosts.has(endpoint.hostname)) {
    throw new OcrInferenceError(
      "OCR gateway endpoint must use HTTPS",
      "configuration",
      false,
    );
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  ) {
    throw new OcrInferenceError(
      "OCR gateway endpoint must not contain credentials, a query, or a fragment",
      "configuration",
      false,
    );
  }
  return endpoint;
}

function normalizeGatewayMimeType(mimeType: string): string {
  const normalized =
    mimeType.toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : mimeType.toLowerCase();
  if (!OCR_GATEWAY_MIME_TYPES.has(normalized)) {
    throw new OcrInferenceError(
      "OCR gateway does not support this image format",
      "unsupported_input",
      false,
    );
  }
  return normalized;
}

function emptyFields(): SemanticCardFields {
  return CARD_FIELDS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {} as SemanticCardFields);
}

function parseSemanticFields(value: unknown): SemanticCardFields {
  const fields = emptyFields();
  if (!value || typeof value !== "object") return fields;
  const record = value as Record<string, unknown>;
  for (const key of CARD_FIELDS) {
    const raw = record[key];
    if (typeof raw === "string") fields[key] = raw;
  }
  return fields;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new OcrInferenceError(
      "VLM response did not contain JSON",
      "invalid_response",
      false,
    );
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new OcrInferenceError(
      "VLM response contained invalid JSON",
      "invalid_response",
      false,
    );
  }
}

async function callAggregator(
  image: string,
  mimeType: string,
  baseUrl: string,
  timeoutMs: number,
): Promise<DualPipelineRaw> {
  const endpoint = assertSecureGatewayUrl(baseUrl);
  const gatewayMimeType = normalizeGatewayMimeType(mimeType);
  ocrLogger.info("Calling authenticated OCR gateway", endpoint.origin);
  const payload = await fetchJson(
    `${baseUrl}/v1/ocr/extract`,
    {
      method: "POST",
      headers: authenticatedGatewayHeaders(),
      body: JSON.stringify({
        model: OCR_GATEWAY_MODEL,
        image: stripDataUrl(image),
        mimeType: gatewayMimeType,
      } satisfies InferenceRequest),
    },
    timeoutMs,
  );

  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;

  if (!isDualPipelineRaw(data)) {
    throw new OcrInferenceError(
      "OCR inference service returned an unexpected payload",
      "invalid_response",
      false,
    );
  }
  return data;
}

function parseClassicPayload(payload: unknown): ClassicOcrResult {
  const root =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  const candidate = (root || {}) as {
    engine?: string;
    rawText?: string;
    raw_text?: string;
    text?: string;
    blocks?: ClassicOcrResult["blocks"];
  };
  const rawText =
    candidate.rawText || candidate.raw_text || candidate.text || "";
  return {
    engine: "pp-ocrv6-medium",
    rawText,
    blocks: Array.isArray(candidate.blocks) ? candidate.blocks : [],
  };
}

async function callPpocr(
  image: string,
  mimeType: string,
  timeoutMs: number,
): Promise<ClassicOcrResult> {
  const base = getPpocrUrl();
  ocrLogger.info("Calling PP-OCRv6", base);
  const payload = await fetchJson(
    `${base.replace(/\/$/, "")}/ocr`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        image: stripDataUrl(image),
        mimeType,
      }),
    },
    timeoutMs,
  );
  return parseClassicPayload(payload);
}

async function callLlamaVlm(
  image: string,
  mimeType: string,
  timeoutMs: number,
): Promise<SemanticExtraction> {
  const base = getVlmUrl();
  const dataUrl = `data:${mimeType};base64,${stripDataUrl(image)}`;
  ocrLogger.info("Calling PaddleOCR-VL llama-server", base);
  const payload = await fetchJson(
    `${base.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        model: getVlmEngine(),
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SEMANTIC_PROMPT },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    },
    timeoutMs,
  );

  const content = (
    payload as {
      choices?: Array<{ message?: { content?: string } }>;
    }
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new OcrInferenceError(
      "VLM llama-server returned empty content",
      "invalid_response",
      false,
    );
  }

  return {
    engine: getVlmEngine(),
    fields: parseSemanticFields(extractJsonObject(content)),
  };
}

export async function callInferenceService(
  image: string,
  mimeType: string,
  timeoutMs = getInferenceTimeoutMs(),
): Promise<DualPipelineRaw> {
  const aggregator = getInferenceBaseUrl();
  if (aggregator) {
    return callAggregator(image, mimeType, aggregator, timeoutMs);
  }

  if (process.env.NODE_ENV === "production") {
    throw new OcrInferenceError(
      "OCR gateway endpoint is not configured",
      "configuration",
      false,
    );
  }

  const [classicResult, semanticResult] = await Promise.allSettled([
    callPpocr(image, mimeType, timeoutMs),
    callLlamaVlm(image, mimeType, timeoutMs),
  ]);

  if (
    classicResult.status === "rejected" ||
    semanticResult.status === "rejected"
  ) {
    const failures = [classicResult, semanticResult]
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      )
      .map((result) => result.reason as unknown);
    const permanentFailure = failures.find(
      (failure) => !isTransientOcrInferenceError(failure),
    );
    throw permanentFailure ?? failures[0];
  }

  return {
    classic: classicResult.value,
    semantic: semanticResult.value,
    qr: [],
  };
}
