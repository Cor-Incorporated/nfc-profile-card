const successfulGeminiResponse = {
  response: {
    text: () =>
      JSON.stringify({
        lastName: "山田",
        firstName: "太郎",
        phoneticLastName: "やまだ",
        phoneticFirstName: "たろう",
        company: "",
        department: "",
        title: "",
        addresses: [],
        email: "",
        website: "",
        phoneNumbers: [],
      }),
  },
};

let generateContentMock: jest.Mock;
let getGenerativeModelMock: jest.Mock;
let ocrLoggerMock: Record<"debug" | "error" | "info" | "warn", jest.Mock>;
let reserveGeminiFallbackBudgetMock: jest.Mock;

async function loadOcrService() {
  jest.resetModules();

  generateContentMock = jest.fn().mockResolvedValue(successfulGeminiResponse);
  reserveGeminiFallbackBudgetMock = jest.fn().mockResolvedValue({
    allowed: true,
    userMonthlyCount: 1,
    globalDailyCount: 1,
  });
  getGenerativeModelMock = jest.fn(() => ({
    generateContent: generateContentMock,
  }));

  jest.doMock("@google/generative-ai", () => ({
    GoogleGenerativeAI: jest.fn(() => ({
      getGenerativeModel: getGenerativeModelMock,
    })),
  }));

  ocrLoggerMock = {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  jest.doMock("@/lib/logger", () => ({ ocrLogger: ocrLoggerMock }));
  jest.doMock(
    "@/services/business-card/ocr/geminiBudgetService.server",
    () => ({
      reserveGeminiFallbackBudget: reserveGeminiFallbackBudgetMock,
    }),
  );

  const provider = await import("./ocr/geminiProvider");
  return {
    ...provider,
    processWithGemini: (
      image: string,
      mimeType: string,
      options: Partial<Parameters<typeof provider.processWithGemini>[2]> = {},
    ) =>
      provider.processWithGemini(image, mimeType, {
        userId: "uid-1",
        ...options,
      }),
    processWithGeminiWithoutUser: (image: string, mimeType: string) =>
      provider.processWithGemini(image, mimeType, { userId: undefined }),
  };
}

describe("processWithGemini Gemini model selection", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-api-key";
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    jest.dontMock("@google/generative-ai");
    jest.dontMock("@/lib/logger");
    jest.dontMock("@/services/business-card/ocr/geminiBudgetService.server");
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("uses the default Gemini model when GEMINI_MODEL is not configured", async () => {
    const { processWithGemini } = await loadOcrService();

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "gemini-3.1-flash-lite",
    });
    expect(reserveGeminiFallbackBudgetMock).toHaveBeenCalledTimes(1);
    expect(reserveGeminiFallbackBudgetMock).toHaveBeenCalledWith("uid-1", {
      deadlineAtMs: undefined,
    });
    expect(
      reserveGeminiFallbackBudgetMock.mock.invocationCallOrder[0],
    ).toBeLessThan(generateContentMock.mock.invocationCallOrder[0]);
  });

  it("fails closed before generateContent when the authenticated user is missing", async () => {
    const { processWithGeminiWithoutUser } = await loadOcrService();

    const result = await processWithGeminiWithoutUser(
      "base64-image",
      "image/png",
    );

    expect(result.success).toBe(false);
    expect(reserveGeminiFallbackBudgetMock).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("fails closed before generateContent when budget reservation fails", async () => {
    const { processWithGemini } = await loadOcrService();
    reserveGeminiFallbackBudgetMock.mockRejectedValueOnce(
      new Error("firestore unavailable"),
    );

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("fails closed before generateContent when the persistent cap is exhausted", async () => {
    const { processWithGemini } = await loadOcrService();
    reserveGeminiFallbackBudgetMock.mockResolvedValueOnce({
      allowed: false,
      reason: "global_daily_cap",
    });

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("accepts non-empty addresses and supported phone types", async () => {
    const payload = {
      ...JSON.parse(successfulGeminiResponse.response.text()),
      addresses: [
        {
          label: "WORK",
          postalCode: "100-0000",
          address: "東京都千代田区",
        },
      ],
      phoneNumbers: [
        { type: "WORK", number: "03-0000-0000" },
        { type: "MOBILE", number: "090-0000-0000" },
        { type: "FAX", number: "03-0000-0001" },
        { type: "OTHER", number: "050-0000-0000" },
      ],
    };
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(payload) },
    });

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(result.contactInfo).toEqual(payload);
  });

  it.each([
    ["missing required keys", { lastName: "山田" }],
    [
      "unknown root keys",
      {
        ...JSON.parse(successfulGeminiResponse.response.text()),
        rawResponse: "must-not-pass",
      },
    ],
    [
      "invalid phone type",
      {
        ...JSON.parse(successfulGeminiResponse.response.text()),
        phoneNumbers: [{ type: "HOME", number: "000-0000" }],
      },
    ],
    [
      "unknown nested keys",
      {
        ...JSON.parse(successfulGeminiResponse.response.text()),
        addresses: [
          {
            label: "WORK",
            postalCode: "000-0000",
            address: "test address",
            confidence: 0.9,
          },
        ],
      },
    ],
    [
      "control characters",
      {
        ...JSON.parse(successfulGeminiResponse.response.text()),
        company: "Example Inc.\r\nURL:https://injected.example.invalid",
      },
    ],
  ])("rejects Gemini payloads with %s", async (_caseName, payload) => {
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockResolvedValueOnce({
      response: { text: () => JSON.stringify(payload) },
    });

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(result.contactInfo).toBeUndefined();
  });

  it("does not log Gemini response text containing card PII", async () => {
    const cardPii = "pii-person@example.invalid";
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockResolvedValueOnce({
      response: { text: () => `not-json ${cardPii}` },
    });

    const result = await processWithGemini("base64-image", "image/png");
    const logged = JSON.stringify(
      Object.values(ocrLoggerMock).flatMap((logger) => logger.mock.calls),
    );

    expect(result.success).toBe(false);
    expect(result.error).not.toContain(cardPii);
    expect(logged).not.toContain(cardPii);
  });

  it("does not log Gemini API error messages or stacks", async () => {
    const cardPii = "private-card-value@example.invalid";
    const { processWithGemini } = await loadOcrService();
    const apiError = new Error(`upstream response contained ${cardPii}`);
    apiError.stack = `Error: ${cardPii}\n at upstream`;
    generateContentMock.mockRejectedValueOnce(apiError);

    const result = await processWithGemini("base64-image", "image/png");
    const logged = JSON.stringify(
      Object.values(ocrLoggerMock).flatMap((logger) => logger.mock.calls),
    );

    expect(result.success).toBe(false);
    expect(result.error).not.toContain(cardPii);
    expect(logged).not.toContain(cardPii);
  });

  it("does not log response extraction error details", async () => {
    const cardPii = "response-error-pii@example.invalid";
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockResolvedValueOnce({
      response: {
        text: () => {
          throw new Error(`response extraction failed for ${cardPii}`);
        },
      },
    });

    const result = await processWithGemini("base64-image", "image/png");
    const logged = JSON.stringify(
      Object.values(ocrLoggerMock).flatMap((logger) => logger.mock.calls),
    );

    expect(result.success).toBe(false);
    expect(result.error).not.toContain(cardPii);
    expect(logged).not.toContain(cardPii);
  });

  it("trims configured model names before calling Gemini", async () => {
    process.env.GEMINI_MODEL = " custom-primary ";
    const { processWithGemini } = await loadOcrService();

    await processWithGemini("base64-image", "image/png");

    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "custom-primary",
    });
  });

  it("falls back when the primary model is unavailable", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const { processWithGemini } = await loadOcrService();
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: [404 Not Found] models/primary-model is not found for API version v1beta",
        ),
      )
      .mockResolvedValueOnce(successfulGeminiResponse);

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, {
      model: "primary-model",
    });
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, {
      model: "fallback-model",
    });
    expect(reserveGeminiFallbackBudgetMock).toHaveBeenCalledTimes(2);
  });

  it("does not call the fallback model when its second reservation is denied", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error(
        "[GoogleGenerativeAI Error]: [404 Not Found] models/primary-model is not found for API version v1beta",
      ),
    );
    reserveGeminiFallbackBudgetMock
      .mockResolvedValueOnce({
        allowed: true,
        userMonthlyCount: 1,
        globalDailyCount: 1,
      })
      .mockResolvedValueOnce({
        allowed: false,
        reason: "global_daily_cap",
      });

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(reserveGeminiFallbackBudgetMock).toHaveBeenCalledTimes(2);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(2);
  });

  it("passes the remaining absolute deadline and abort signal to Gemini", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const { processWithGemini } = await loadOcrService();

    const result = await processWithGemini("base64-image", "image/png", {
      deadlineAtMs: 2500,
    });

    expect(result.success).toBe(true);
    expect(generateContentMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        timeout: 1500,
        signal: expect.anything(),
      }),
    );
    now.mockRestore();
  });

  it("aborts an active Gemini request when the deadline expires", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(1000);
    const { processWithGemini } = await loadOcrService();
    let requestSignal: AbortSignal | undefined;
    generateContentMock.mockImplementation(
      (_request: unknown, options?: { signal?: AbortSignal }) => {
        requestSignal = options?.signal;
        return new Promise((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      },
    );

    const request = processWithGemini("base64-image", "image/png", {
      deadlineAtMs: 1050,
    });
    await jest.advanceTimersByTimeAsync(50);
    const result = await request;

    expect(result.success).toBe(false);
    expect(requestSignal?.aborted).toBe(true);
    expect(result.error).toBe(
      "処理に時間がかかりすぎています。画像を再撮影してお試しください。",
    );
  });

  it("classifies an already-expired deadline without calling Gemini", async () => {
    const now = jest.spyOn(Date, "now").mockReturnValue(2000);
    const { processWithGemini } = await loadOcrService();

    const result = await processWithGemini("base64-image", "image/png", {
      deadlineAtMs: 1999,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "処理に時間がかかりすぎています。画像を再撮影してお試しください。",
    );
    expect(reserveGeminiFallbackBudgetMock).not.toHaveBeenCalled();
    expect(generateContentMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("does not send the image to a second model after the deadline", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1000)
      .mockReturnValue(2001);
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error(
        "[GoogleGenerativeAI Error]: [404 Not Found] models/primary-model is not found for API version v1beta",
      ),
    );

    const result = await processWithGemini("base64-image", "image/png", {
      deadlineAtMs: 2000,
    });

    expect(result.success).toBe(false);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
    now.mockRestore();
  });

  it("falls back when the primary model does not support content generation", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const { processWithGemini } = await loadOcrService();
    generateContentMock
      .mockRejectedValueOnce(
        new Error("models/primary-model is not supported for generateContent"),
      )
      .mockResolvedValueOnce(successfulGeminiResponse);

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, {
      model: "primary-model",
    });
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, {
      model: "fallback-model",
    });
  });

  it.each([
    "[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota for model gemini-3.1-flash-lite",
    "Candidate was blocked due to SAFETY. The model returned no content.",
    "[503 Service Unavailable] The model is overloaded. Please try again later.",
    "[401 Unauthorized] API key not valid. Please pass a valid API key.",
    "DEADLINE_EXCEEDED",
    "Invalid or unsupported image data",
  ])(
    "does not fall back for non-model-availability errors: %s",
    async (message) => {
      process.env.GEMINI_MODEL = "primary-model";
      process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
      const { processWithGemini } = await loadOcrService();
      generateContentMock.mockRejectedValueOnce(new Error(message));

      const result = await processWithGemini("base64-image", "image/png");

      expect(result.success).toBe(false);
      expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
      expect(getGenerativeModelMock).toHaveBeenCalledWith({
        model: "primary-model",
      });
    },
  );

  it("does not fall back when the fallback matches the primary model", async () => {
    process.env.GEMINI_MODEL = "same-model";
    process.env.GEMINI_FALLBACK_MODEL = "same-model";
    const { processWithGemini } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error(
        "[GoogleGenerativeAI Error]: [404 Not Found] models/same-model is not found for API version v1beta",
      ),
    );

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "same-model",
    });
  });
});
