import {
  OcrInferenceError,
  callInferenceService,
  isTransientOcrInferenceError,
} from "./inferenceClient";

describe("OCR inference failure classification", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.OCR_INFERENCE_URL = "http://127.0.0.1:8090";
    process.env.OCR_INFERENCE_API_KEY = "test-gateway-token";
    process.env.OCR_INFERENCE_TIMEOUT_MS = "50";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it.each([408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524])(
    "classifies HTTP %i as a transient upstream outage",
    async (status) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
      }) as jest.Mock;

      await expect(
        callInferenceService("base64-image", "image/png"),
      ).rejects.toMatchObject({
        kind: "unavailable",
        retryable: true,
        status,
      });
    },
  );

  it.each([400, 401, 403, 404, 501])(
    "keeps HTTP %i fail-closed",
    async (status) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status,
      }) as jest.Mock;

      await expect(
        callInferenceService("base64-image", "image/png"),
      ).rejects.toMatchObject({
        kind: "http",
        retryable: false,
        status,
      });
    },
  );

  it("keeps authorization errors fail-closed", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as jest.Mock;

    const error = await callInferenceService("base64-image", "image/png").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(OcrInferenceError);
    expect(error).toMatchObject({
      kind: "http",
      retryable: false,
      status: 401,
    });
    expect(isTransientOcrInferenceError(error)).toBe(false);
  });

  it("classifies network errors as transient without leaking the endpoint", async () => {
    const cause = Object.assign(new Error("connect failed"), {
      code: "ECONNREFUSED",
    });
    const fetchError = new TypeError("fetch failed for secret-host", {
      cause,
    });
    global.fetch = jest.fn().mockRejectedValue(fetchError) as jest.Mock;

    const error = await callInferenceService("base64-image", "image/png").catch(
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({ kind: "network", retryable: true });
    expect((error as Error).message).not.toContain("secret-host");
  });

  it("keeps TypeError configuration failures from triggering cloud fallback", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(
        new TypeError("Headers.append: invalid Authorization value"),
      ) as jest.Mock;

    const error = await callInferenceService("base64-image", "image/png").catch(
      (caught: unknown) => caught,
    );

    expect(error).toMatchObject({
      kind: "configuration",
      retryable: false,
    });
    expect((error as Error).message).not.toContain("Authorization");
  });

  it("keeps malformed success payloads fail-closed", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ unexpected: true }),
    }) as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "invalid_response",
      retryable: false,
    });
  });

  it("fails before dispatch when the dedicated gateway token is missing", async () => {
    delete process.env.OCR_INFERENCE_API_KEY;
    global.fetch = jest.fn() as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "configuration",
      retryable: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects non-loopback HTTP gateways before sending the image", async () => {
    process.env.OCR_INFERENCE_URL = "http://ocr-gateway.example.com";
    global.fetch = jest.fn() as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "configuration",
      retryable: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects credentials embedded in the gateway URL before sending the image", async () => {
    process.env.OCR_INFERENCE_URL =
      "https://user:password@ocr-gateway.example.com";
    global.fetch = jest.fn() as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "configuration",
      retryable: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends only the authenticated nfc-ocr gateway contract", async () => {
    process.env.OCR_INFERENCE_API_KEY = "test-gateway-token";
    process.env.OCR_VLM_ENGINE = "hunyuanocr-1.5";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: {
          classic: { engine: "mock", rawText: "Cor", blocks: [] },
          semantic: { engine: "mock", fields: { company: "Cor" } },
          qr: [],
        },
      }),
    }) as jest.Mock;

    const result = await callInferenceService(
      "data:image/png;base64,ZmFrZQ==",
      "image/png",
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];

    expect(result.classic.rawText).toBe("Cor");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-gateway-token",
    });
    expect(JSON.parse(init.body as string)).toEqual({
      model: "nfc-ocr",
      image: "ZmFrZQ==",
      mimeType: "image/png",
    });
  });

  it("normalizes the JPEG alias to the gateway MIME contract", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        success: true,
        data: {
          classic: { engine: "mock", rawText: "Cor", blocks: [] },
          semantic: { engine: "mock", fields: { company: "Cor" } },
          qr: [],
        },
      }),
    }) as jest.Mock;

    await callInferenceService("base64-image", "image/jpg");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      URL,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string).mimeType).toBe("image/jpeg");
  });

  it("rejects formats outside the gateway contract before dispatch", async () => {
    global.fetch = jest.fn() as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/heic"),
    ).rejects.toMatchObject({
      kind: "unsupported_input",
      retryable: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("classifies an aborted request as a transient timeout", async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }) as jest.Mock;

    const request = expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "timeout",
      retryable: true,
    });
    await jest.advanceTimersByTimeAsync(50);
    await request;
  });

  it("preserves an abort while reading the JSON response as a timeout", async () => {
    const abortError = new Error("body read aborted");
    abortError.name = "AbortError";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(abortError),
    }) as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "timeout",
      retryable: true,
    });
  });

  it("waits for both native engines and prioritizes permanent failures", async () => {
    delete process.env.OCR_INFERENCE_URL;
    process.env.OCR_PPOCR_URL = "http://127.0.0.1:8093";
    process.env.OCR_VLM_URL = "http://127.0.0.1:8092/v1";
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: false, status: 401 }) as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "http",
      retryable: false,
      status: 401,
    });
  });

  it("does not restore direct engine calls when the production gateway is missing", async () => {
    delete process.env.OCR_INFERENCE_URL;
    process.env.OCR_PPOCR_URL = "http://127.0.0.1:8093";
    process.env.OCR_VLM_URL = "http://127.0.0.1:8092/v1";
    process.env = { ...process.env, NODE_ENV: "production" };
    global.fetch = jest.fn() as jest.Mock;

    await expect(
      callInferenceService("base64-image", "image/png"),
    ).rejects.toMatchObject({
      kind: "configuration",
      retryable: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
