import { ContactInfo } from "@/types/business-card";
import { isIP } from "node:net";
import { z } from "zod";

const ALLOWED_OLLAMA_MODELS = new Set([
  "gemma4:e2b",
  "gemma4:e4b",
  "gemma4:12b",
  "gemma4:31b",
]);
const ACCESS_HOST = "nfc-ocr.tapforge.org";
// Access credentials may only be sent to an explicitly selected TapForge host.
const TAPFORGE_ACCESS_HOST =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+tapforge\.org$/;
const OLLAMA_TIMEOUT_MS = 24_000;
const MAX_RESPONSE_BYTES = 64_000;
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const ERROR_MESSAGE =
  "実験的なローカルOCRを利用できません。設定・接続を確認してください。";
const IMAGE_FORMAT_ERROR =
  "実験的なローカルOCRはJPEG、PNG、WebP形式の画像に対応しています。";

const boundedText = z.string().max(500);
const contactSchema = z
  .object({
    lastName: boundedText,
    firstName: boundedText,
    phoneticLastName: boundedText,
    phoneticFirstName: boundedText,
    company: boundedText,
    department: boundedText,
    title: boundedText,
    addresses: z
      .array(
        z
          .object({
            label: boundedText,
            postalCode: boundedText,
            address: boundedText,
          })
          .strict(),
      )
      .max(5),
    email: boundedText,
    website: boundedText,
    phoneNumbers: z
      .array(
        z
          .object({
            type: z.enum(["WORK", "MOBILE", "FAX", "OTHER"]),
            number: boundedText,
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

const contactJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    lastName: { type: "string" },
    firstName: { type: "string" },
    phoneticLastName: { type: "string" },
    phoneticFirstName: { type: "string" },
    company: { type: "string" },
    department: { type: "string" },
    title: { type: "string" },
    addresses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: { type: "string" },
          postalCode: { type: "string" },
          address: { type: "string" },
        },
        required: ["label", "postalCode", "address"],
      },
    },
    email: { type: "string" },
    website: { type: "string" },
    phoneNumbers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["WORK", "MOBILE", "FAX", "OTHER"] },
          number: { type: "string" },
        },
        required: ["type", "number"],
      },
    },
  },
  required: [
    "lastName",
    "firstName",
    "phoneticLastName",
    "phoneticFirstName",
    "company",
    "department",
    "title",
    "addresses",
    "email",
    "website",
    "phoneNumbers",
  ],
} as const;

const OCR_PROMPT = `名刺画像に実際に見える情報だけを、指定されたJSON形式で抽出してください。
姓と名、ふりがな、会社、部署、役職、住所、メール、URL、電話番号を読み取ります。
見えない項目や1文字でも判読できない項目は空文字列または空配列にしてください。
推測・補完・説明文は不要です。保存前にユーザーが全項目を確認します。`;

function getGatewayConfig() {
  const rawUrl = process.env.NFC_OCR_OLLAMA_GATEWAY_URL?.trim();
  const model = process.env.NFC_OCR_OLLAMA_MODEL?.trim();
  const token = process.env.NFC_OCR_OLLAMA_GATEWAY_TOKEN?.trim();
  const accessClientId = process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_ID?.trim();
  const accessClientSecret =
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_SECRET?.trim();
  const accessHostnameSetting = process.env.NFC_OCR_OLLAMA_ACCESS_HOSTNAME;
  const accessHostname =
    accessHostnameSetting === undefined
      ? ACCESS_HOST
      : accessHostnameSetting.trim().toLowerCase();
  if (!rawUrl) throw new Error("Ollama gateway URL is missing");
  if (!model || !ALLOWED_OLLAMA_MODELS.has(model)) {
    throw new Error("Ollama OCR model is missing or unsupported");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Ollama gateway URL is invalid");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const localDevelopment =
    process.env.NODE_ENV !== "production" &&
    loopback &&
    url.protocol === "http:";
  if (
    url.pathname !== (localDevelopment ? "/api/chat" : "/v1/ocr/ollama/chat") ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error("Ollama gateway path is invalid");
  }
  const completeAccessPair = !!accessClientId && !!accessClientSecret;

  if (
    !TAPFORGE_ACCESS_HOST.test(accessHostname) ||
    accessHostname.length > 253 ||
    accessHostname.split(".").some((label) => label.startsWith("xn--")) ||
    [token, accessClientId, accessClientSecret].some(
      (value) => value && /\s/.test(value),
    )
  ) {
    throw new Error("Ollama gateway authentication is invalid");
  }

  if (localDevelopment) {
    if (
      token ||
      accessClientId ||
      accessClientSecret ||
      accessHostnameSetting !== undefined
    ) {
      throw new Error(
        "Ollama local endpoint must not receive gateway credentials",
      );
    }
  } else {
    if (
      url.protocol !== "https:" ||
      (url.port && url.port !== "443") ||
      hostname.endsWith(".") ||
      isIP(hostname) !== 0 ||
      !hostname.includes(".") ||
      /(^|\.)(localhost|local|internal|lan|test|example|invalid)$/.test(
        hostname,
      ) ||
      !token ||
      !completeAccessPair ||
      hostname !== accessHostname
    ) {
      throw new Error(
        "Ollama gateway must be an authenticated public HTTPS endpoint",
      );
    }
  }

  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders.Authorization = `Bearer ${token}`;
  }
  if (accessClientId && accessClientSecret) {
    authHeaders["CF-Access-Client-Id"] = accessClientId;
    authHeaders["CF-Access-Client-Secret"] = accessClientSecret;
  }
  return { url: url.toString(), authHeaders, model };
}

function base64Image(image: string, mimeType: string): string {
  const dataUrl = /^data:(image\/[a-z]+);base64,/i.exec(image);
  if (
    image.startsWith("data:") &&
    (!dataUrl || dataUrl[1].toLowerCase() !== mimeType.toLowerCase())
  ) {
    throw new Error("Ollama OCR image data URL is invalid");
  }
  const encoded = dataUrl ? image.slice(dataUrl[0].length) : image;
  if (
    !encoded ||
    encoded.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)
  ) {
    throw new Error("Ollama OCR image data is invalid");
  }
  return encoded;
}

async function readBoundedResponse(
  response: Response,
  controller: AbortController,
): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let raw = "";
  let bytesRead = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return raw + decoder.decode();
      bytesRead += value.byteLength;
      if (bytesRead > MAX_RESPONSE_BYTES) {
        controller.abort();
        return null;
      }
      raw += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

export async function processWithOllama(
  image: string,
  mimeType: string,
  startedAtMs: number,
  deadlineAtMs: number,
): Promise<{
  success: boolean;
  contactInfo?: ContactInfo;
  processingTime: number;
  error?: string;
}> {
  const failed = () => ({
    success: false,
    processingTime: Date.now() - startedAtMs,
    error: ERROR_MESSAGE,
  });

  if (!SUPPORTED_IMAGE_TYPES.includes(mimeType.toLowerCase())) {
    return { ...failed(), error: IMAGE_FORMAT_ERROR };
  }

  try {
    const { url, authHeaders, model } = getGatewayConfig();
    const encoded = base64Image(image, mimeType);
    const timeoutMs = Math.min(OLLAMA_TIMEOUT_MS, deadlineAtMs - Date.now());
    if (timeoutMs < 1_000) return failed();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: OCR_PROMPT, images: [encoded] }],
          format: contactJsonSchema,
          options: { temperature: 0 },
          stream: false,
        }),
        redirect: "error",
        signal: controller.signal,
      });
      if (!response.ok) return failed();
      if (Number(response.headers.get("content-length")) > MAX_RESPONSE_BYTES) {
        controller.abort();
        return failed();
      }
      const raw = await readBoundedResponse(response, controller);
      if (raw === null) return failed();
      const envelope = JSON.parse(raw) as {
        done?: unknown;
        model?: unknown;
        message?: { content?: unknown };
      };
      if (
        envelope.done !== true ||
        envelope.model !== model ||
        typeof envelope.message?.content !== "string"
      ) {
        return failed();
      }
      const contactInfo = contactSchema.parse(
        JSON.parse(envelope.message.content),
      );
      return {
        success: true,
        contactInfo,
        processingTime: Date.now() - startedAtMs,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Never expose the image, generated text, gateway address, or token in logs/errors.
    return failed();
  }
}
