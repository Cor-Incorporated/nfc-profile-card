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
  VlmEngine,
} from "@/lib/ocr/types";
import { CARD_FIELDS } from "@/lib/ocr/types";
import { ocrLogger } from "@/lib/logger";

export interface InferenceRequest {
  image: string;
  mimeType: string;
  vlmEngine: VlmEngine;
}

const SEMANTIC_PROMPT = `Extract business-card fields as JSON only.
Keys: name, name_kana, company, department, title, email, phone, mobile, fax, postal_code, address, url, social.
Associate name / company / title from layout. Do not invent email, phone, URL, or postal_code if they are not visible. Empty string if unseen.`;

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `OCR inference ${url} returned ${response.status}: ${detail.slice(0, 200)}`,
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`OCR inference timed out: ${url}`);
    }
    throw error;
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
    throw new Error("VLM response did not contain JSON");
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function callAggregator(
  image: string,
  mimeType: string,
  baseUrl: string,
): Promise<DualPipelineRaw> {
  const vlmEngine = getVlmEngine();
  ocrLogger.info("Calling OCR aggregator (local-dev)", baseUrl, vlmEngine);
  const payload = await fetchJson(
    `${baseUrl}/v1/ocr/extract`,
    {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        image: stripDataUrl(image),
        mimeType,
        vlmEngine,
      } satisfies InferenceRequest),
    },
    getInferenceTimeoutMs(),
  );

  const data =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: unknown }).data
      : payload;

  if (!isDualPipelineRaw(data)) {
    throw new Error("OCR inference service returned an unexpected payload");
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
    getInferenceTimeoutMs(),
  );
  return parseClassicPayload(payload);
}

async function callLlamaVlm(
  image: string,
  mimeType: string,
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
    getInferenceTimeoutMs(),
  );

  const content = (
    payload as {
      choices?: Array<{ message?: { content?: string } }>;
    }
  )?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("VLM llama-server returned empty content");
  }

  return {
    engine: getVlmEngine(),
    fields: parseSemanticFields(extractJsonObject(content)),
  };
}

export async function callInferenceService(
  image: string,
  mimeType: string,
): Promise<DualPipelineRaw> {
  const aggregator = getInferenceBaseUrl();
  if (aggregator) {
    return callAggregator(image, mimeType, aggregator);
  }

  const [classic, semantic] = await Promise.all([
    callPpocr(image, mimeType),
    callLlamaVlm(image, mimeType),
  ]);

  return { classic, semantic, qr: [] };
}
