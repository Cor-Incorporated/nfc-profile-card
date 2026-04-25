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

  return import("./ocrService");
}

describe("processBusinessCardImage Gemini model selection", () => {
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
    const { processBusinessCardImage } = await loadOcrService();

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "gemini-3.1-flash-lite-preview",
    });
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
      .mockRejectedValueOnce(new Error("models/primary-model is not found"))
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

  it("does not fall back for quota errors", async () => {
    process.env.GEMINI_MODEL = "primary-model";
    process.env.GEMINI_FALLBACK_MODEL = "fallback-model";
    const { processBusinessCardImage } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error("RESOURCE_EXHAUSTED quota exceeded"),
    );

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "primary-model",
    });
  });

  it("does not fall back when the fallback matches the primary model", async () => {
    process.env.GEMINI_MODEL = "same-model";
    process.env.GEMINI_FALLBACK_MODEL = "same-model";
    const { processBusinessCardImage } = await loadOcrService();
    generateContentMock.mockRejectedValueOnce(
      new Error("models/same-model is not found"),
    );

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(getGenerativeModelMock).toHaveBeenCalledTimes(1);
    expect(getGenerativeModelMock).toHaveBeenCalledWith({
      model: "same-model",
    });
  });
});
