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
let googleGenerativeAiMock: jest.Mock;
let processWithOllamaMock: jest.Mock;

async function loadOcrService() {
  jest.resetModules();

  generateContentMock = jest.fn().mockResolvedValue(successfulGeminiResponse);
  getGenerativeModelMock = jest.fn(() => ({
    generateContent: generateContentMock,
  }));

  googleGenerativeAiMock = jest.fn(() => ({
    getGenerativeModel: getGenerativeModelMock,
  }));
  processWithOllamaMock = jest.fn().mockResolvedValue({
    success: true,
    contactInfo: { email: "local@example.com" },
    processingTime: 1,
  });

  jest.doMock("@google/generative-ai", () => ({
    GoogleGenerativeAI: googleGenerativeAiMock,
  }));
  jest.doMock("./ollamaOcrService", () => ({
    processWithOllama: processWithOllamaMock,
  }));

  jest.doMock("@/lib/logger", () => ({
    ocrLogger: {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    },
  }));

  return import("./ocrService");
}

describe("processBusinessCardImage Gemini model selection", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-api-key";
    delete process.env.NFC_GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.NFC_OCR_OLLAMA_EXPERIMENT;
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.NFC_GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    delete process.env.NFC_OCR_OLLAMA_EXPERIMENT;
    jest.dontMock("@google/generative-ai");
    jest.dontMock("./ollamaOcrService");
    jest.dontMock("@/lib/logger");
  });

  it("uses the default Gemini model when GEMINI_MODEL is not configured", async () => {
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "gemini-3.5-flash-lite",
    });
    expect(processWithOllamaMock).not.toHaveBeenCalled();
  });

  it("keeps Gemini as the explicit disabled mode", async () => {
    process.env.NFC_OCR_OLLAMA_EXPERIMENT = "false";
    const { processBusinessCardImage } = await loadOcrService();

    expect(
      (await processBusinessCardImage("base64-image", "image/png")).success,
    ).toBe(true);
    expect(googleGenerativeAiMock).toHaveBeenCalledTimes(1);
    expect(processWithOllamaMock).not.toHaveBeenCalled();
  });

  it.each(["tru", "TRUE", "", "true "])(
    "rejects an invalid OCR selection before dispatch: %j",
    async (selection) => {
      process.env.NFC_OCR_OLLAMA_EXPERIMENT = selection;
      const { processBusinessCardImage } = await loadOcrService();

      const result = await processBusinessCardImage(
        "base64-image",
        "image/png",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Provider selection is invalid");
      expect(googleGenerativeAiMock).not.toHaveBeenCalled();
      expect(processWithOllamaMock).not.toHaveBeenCalled();
    },
  );

  it("uses Ollama only after explicit experimental opt-in", async () => {
    process.env.NFC_OCR_OLLAMA_EXPERIMENT = "true";
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("cG5n", "image/png", {
      deadlineAtMs: 20_000,
    });

    expect(result.success).toBe(true);
    expect(processWithOllamaMock).toHaveBeenCalledWith(
      "cG5n",
      "image/png",
      expect.any(Number),
      20_000,
    );
    expect(googleGenerativeAiMock).not.toHaveBeenCalled();
  });

  it("does not silently send the image to Gemini when Ollama fails", async () => {
    process.env.NFC_OCR_OLLAMA_EXPERIMENT = "true";
    const { processBusinessCardImage } = await loadOcrService();
    processWithOllamaMock.mockResolvedValue({
      success: false,
      processingTime: 1,
      error: "local inference unavailable",
    });

    const result = await processBusinessCardImage("cG5n", "image/png");

    expect(result.success).toBe(false);
    expect(googleGenerativeAiMock).not.toHaveBeenCalled();
  });

  it("uses the NFC key in preference to a configured legacy key", async () => {
    process.env.NFC_GEMINI_API_KEY = " nfc-test-api-key ";
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(googleGenerativeAiMock).toHaveBeenCalledWith("nfc-test-api-key");
  });

  it("uses the legacy key only when the NFC key is absent", async () => {
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(googleGenerativeAiMock).toHaveBeenCalledWith("test-api-key");
  });

  it("rejects a blank NFC key instead of falling back to the legacy key", async () => {
    process.env.NFC_GEMINI_API_KEY = "  ";
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(result.error).toContain("API key is missing");
    expect(googleGenerativeAiMock).not.toHaveBeenCalled();
  });

  it("trims configured model names before calling Gemini", async () => {
    process.env.GEMINI_MODEL = " custom-primary ";
    const { processBusinessCardImage } = await loadOcrService();

    await processBusinessCardImage("base64-image", "image/png");

    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "custom-primary",
    });
  });

  it("falls back when the primary model is unavailable", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const { processBusinessCardImage } = await loadOcrService();
    generateContentMock
      .mockRejectedValueOnce(
        new Error(
          "[GoogleGenerativeAI Error]: [404 Not Found] models/primary-model is not found for API version v1beta",
        ),
      )
      .mockResolvedValueOnce(successfulGeminiResponse);

    const result = await processBusinessCardImage("base64-image", "image/png");

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
    const { processBusinessCardImage } = await loadOcrService();
    generateContentMock
      .mockRejectedValueOnce(
        new Error("models/primary-model is not supported for generateContent"),
      )
      .mockResolvedValueOnce(successfulGeminiResponse);

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(1, {
      model: "primary-model",
    });
    expect(getGenerativeModelMock).toHaveBeenNthCalledWith(2, {
      model: "fallback-model",
    });
  });

  it.each([
    "[GoogleGenerativeAI Error]: [429 Too Many Requests] You exceeded your current quota for model gemini-3.5-flash-lite",
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
      const { processBusinessCardImage } = await loadOcrService();
      generateContentMock.mockRejectedValueOnce(new Error(message));

      const result = await processBusinessCardImage(
        "base64-image",
        "image/png",
      );

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
    const { processBusinessCardImage } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error(
        "[GoogleGenerativeAI Error]: [404 Not Found] models/same-model is not found for API version v1beta",
      ),
    );

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "same-model",
    });
  });
});
