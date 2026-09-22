import { processWithOllama } from "./ollamaOcrService";

const syntheticContact = {
  lastName: "山田",
  firstName: "太郎",
  phoneticLastName: "やまだ",
  phoneticFirstName: "たろう",
  company: "架空株式会社",
  department: "研究部",
  title: "担当",
  addresses: [],
  email: "taro@example.com",
  website: "",
  phoneNumbers: [{ type: "WORK", number: "03-0000-0000" }],
};

function gatewayResponse(
  contact: unknown = syntheticContact,
  model = "gemma4:e4b",
) {
  const bytes = Buffer.from(
    JSON.stringify({
      model,
      done: true,
      message: { content: JSON.stringify(contact) },
    }),
  );
  return {
    ok: true,
    headers: { get: () => null },
    body: {
      getReader: () => {
        let offset = 0;
        return {
          read: async () => {
            if (offset >= bytes.length) return { done: true };
            const value = bytes.subarray(offset, offset + 45);
            offset += value.length;
            return { done: false, value };
          },
          releaseLock: () => undefined,
        };
      },
    },
  } as unknown as Response;
}

describe("experimental Ollama OCR gateway", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL =
      "https://ocr-gateway.example.com/v1/ocr/ollama/chat";
    process.env.NFC_OCR_OLLAMA_MODEL = "gemma4:e4b";
    process.env.NFC_OCR_OLLAMA_GATEWAY_TOKEN = "test-gateway-token";
    delete process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_ID;
    delete process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_SECRET;
    fetchMock = jest.fn().mockResolvedValue(gatewayResponse());
    globalThis.fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
  });

  const scan = (mimeType = "image/png", image = "cG5n") =>
    processWithOllama(image, mimeType, Date.now(), Date.now() + 28_000);

  it("sends one authenticated structured vision request and validates ContactInfo", async () => {
    const result = await scan();

    expect(result.success).toBe(true);
    expect(result.contactInfo).toEqual(syntheticContact);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://ocr-gateway.example.com/v1/ocr/ollama/chat");
    expect(init.redirect).toBe("error");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-gateway-token",
    });
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "gemma4:e4b",
      stream: false,
      options: { temperature: 0 },
    });
    expect(body.messages[0].images).toEqual(["cG5n"]);
    expect(body.format.required).toContain("title");
  });

  it("uses Cloudflare Access and OCR gateway Bearer together", async () => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL =
      "https://nfc-ocr.tapforge.org/v1/ocr/ollama/chat";
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_ID = "synthetic-id.access";
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_SECRET = "synthetic-secret";

    expect((await scan()).success).toBe(true);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers;
    expect(headers).toMatchObject({
      Authorization: "Bearer test-gateway-token",
      "CF-Access-Client-Id": "synthetic-id.access",
      "CF-Access-Client-Secret": "synthetic-secret",
    });
  });

  it("does not send Access credentials to another public hostname", async () => {
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_ID = "synthetic-id.access";
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_SECRET = "synthetic-secret";

    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires the Access pair for the existing OCR hostname", async () => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL =
      "https://nfc-ocr.tapforge.org/v1/ocr/ollama/chat";

    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects incomplete Access or missing gateway Bearer before dispatch", async () => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL =
      "https://nfc-ocr.tapforge.org/v1/ocr/ollama/chat";
    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_ID = "synthetic-id.access";
    expect((await scan()).success).toBe(false);

    process.env.NFC_OCR_OLLAMA_ACCESS_CLIENT_SECRET = "synthetic-secret";
    delete process.env.NFC_OCR_OLLAMA_GATEWAY_TOKEN;
    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["missing token", "https://ocr-gateway.example.com/v1/ocr/ollama/chat", ""],
    [
      "remote HTTP",
      "http://ocr-gateway.example.com/v1/ocr/ollama/chat",
      "token",
    ],
    ["private IP", "https://192.168.1.2/v1/ocr/ollama/chat", "token"],
    ["loopback HTTPS", "https://127.0.0.1/v1/ocr/ollama/chat", "token"],
    ["trailing-dot loopback", "https://localhost./v1/ocr/ollama/chat", "token"],
    [
      "placeholder domain",
      "https://ocr-gateway.example.invalid/v1/ocr/ollama/chat",
      "token",
    ],
    ["wrong path", "https://ocr-gateway.example.com/api/generate", "token"],
    ["direct Ollama path", "https://ocr-gateway.example.com/api/chat", "token"],
    [
      "URL credentials",
      "https://name:password@ocr-gateway.example.com/v1/ocr/ollama/chat",
      "token",
    ],
  ])("fails closed for %s", async (_, url, token) => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL = url;
    process.env.NFC_OCR_OLLAMA_GATEWAY_TOKEN = token;

    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("permits loopback HTTP only for local development", async () => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL = "http://127.0.0.1:11434/api/chat";
    delete process.env.NFC_OCR_OLLAMA_GATEWAY_TOKEN;

    const result = await scan();

    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty(
      "Authorization",
    );
  });

  it("keeps gateway credentials off local loopback", async () => {
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL = "http://127.0.0.1:11434/api/chat";

    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("requires an explicit supported model", async () => {
    delete process.env.NFC_OCR_OLLAMA_MODEL;
    expect((await scan()).success).toBe(false);

    process.env.NFC_OCR_OLLAMA_MODEL = "unreviewed-model";
    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects an installed Mac Studio model explicitly", async () => {
    process.env.NFC_OCR_OLLAMA_MODEL = "gemma4:12b";
    fetchMock.mockResolvedValueOnce(
      gatewayResponse(syntheticContact, "gemma4:12b"),
    );

    expect((await scan()).success).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.model).toBe("gemma4:12b");
  });

  it("rejects loopback HTTP in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NFC_OCR_OLLAMA_GATEWAY_URL = "http://127.0.0.1:11434/api/chat";

    expect((await scan()).success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported input without dispatch", async () => {
    const result = await scan("image/heic");
    expect(result.success).toBe(false);
    expect(result.error).toContain("JPEG、PNG、WebP");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts a response that exceeds 64k bytes before buffering it", async () => {
    const read = jest
      .fn()
      .mockResolvedValueOnce({ done: false, value: Buffer.alloc(64_001) })
      .mockResolvedValue({ done: true });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
      body: { getReader: () => ({ read, releaseLock: () => undefined }) },
    });

    expect((await scan()).success).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(
      true,
    );
  });

  it("accepts the JPEG MIME alias used by the scan route", async () => {
    expect((await scan("image/jpg")).success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed model fields and wrong model responses", async () => {
    fetchMock.mockResolvedValueOnce(
      gatewayResponse({ ...syntheticContact, title: 42 }),
    );
    expect((await scan()).success).toBe(false);

    fetchMock.mockResolvedValueOnce(gatewayResponse(syntheticContact, "other"));
    expect((await scan()).success).toBe(false);
  });

  it("does not dispatch when the route has less than one second left", async () => {
    const result = await processWithOllama(
      "cG5n",
      "image/png",
      Date.now(),
      Date.now() + 500,
    );

    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aborts an unanswered gateway request after twenty-four seconds", async () => {
    jest.useFakeTimers();
    const aborted = jest.fn();
    fetchMock.mockImplementationOnce(
      (_: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            aborted();
            reject(new Error("aborted"));
          });
        }),
    );

    const pending = scan();
    await jest.advanceTimersByTimeAsync(24_000);

    expect((await pending).success).toBe(false);
    expect(aborted).toHaveBeenCalledTimes(1);
  });
});
