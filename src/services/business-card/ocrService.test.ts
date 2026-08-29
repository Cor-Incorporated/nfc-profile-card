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

async function loadOcrService() {
  jest.resetModules();

  generateContentMock = jest.fn().mockResolvedValue(successfulGeminiResponse);
  getGenerativeModelMock = jest.fn(() => ({
    generateContent: generateContentMock,
  }));

  jest.doMock("@google/generative-ai", () => ({
    GoogleGenerativeAI: jest.fn(() => ({
      getGenerativeModel: getGenerativeModelMock,
    })),
  }));

  jest.doMock("@/lib/logger", () => ({
    ocrLogger: {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
  }));

  return import("./ocr/geminiProvider");
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
  });

  it("uses the default Gemini model when GEMINI_MODEL is not configured", async () => {
    const { processWithGemini } = await loadOcrService();

    const result = await processWithGemini("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "gemini-3.1-flash-lite-preview",
    });
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
    "[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota for model gemini-3.1-flash-lite-preview",
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
