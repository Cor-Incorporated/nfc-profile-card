import { createMockDualPipeline } from "./ocr/mockInference";

const processWithGeminiMock = jest.fn();
const callInferenceServiceMock = jest.fn();
const isTransientOcrInferenceErrorMock = jest.fn();

async function loadOrchestrator() {
  jest.resetModules();
  processWithGeminiMock.mockReset();
  callInferenceServiceMock.mockReset();
  isTransientOcrInferenceErrorMock.mockReset();
  isTransientOcrInferenceErrorMock.mockReturnValue(false);
  processWithGeminiMock.mockResolvedValue({
    success: true,
    contactInfo: { email: "gemini@example.com" },
    processingTime: 10,
  });

  jest.doMock("@/services/business-card/ocr/geminiProvider", () => ({
    processWithGemini: processWithGeminiMock,
  }));
  jest.doMock("@/services/business-card/ocr/inferenceClient", () => ({
    OcrInferenceError: class OcrInferenceError extends Error {},
    callInferenceService: callInferenceServiceMock,
    isTransientOcrInferenceError: isTransientOcrInferenceErrorMock,
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

describe("processBusinessCardImage orchestrator", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OCR_PROVIDER;
    delete process.env.OCR_ENABLE_GEMINI_FALLBACK;
    delete process.env.OCR_INFERENCE_MODE;
    delete process.env.OCR_INFERENCE_TIMEOUT_MS;
    delete process.env.OCR_TOTAL_TIMEOUT_MS;
    delete process.env.OCR_GEMINI_FALLBACK_TIMEOUT_MS;
    jest.restoreAllMocks();
    jest.dontMock("@/services/business-card/ocr/geminiProvider");
    jest.dontMock("@/services/business-card/ocr/inferenceClient");
    jest.dontMock("@/lib/logger");
  });

  it("uses the local mock pipeline by default and does not call Gemini", async () => {
    process.env.OCR_INFERENCE_MODE = "mock";
    const { processBusinessCardImage } = await loadOrchestrator();

    const result = await processBusinessCardImage("base64-image", "image/png", {
      userId: "uid-1",
    });

    expect(result.success).toBe(true);
    expect(result.engine).toContain("mock");
    expect(result.contactInfo?.email).toBe("taro.yamada@tapforge.example");
    expect(result.humanReview).toBe(false);
    expect(processWithGeminiMock).not.toHaveBeenCalled();
    expect(callInferenceServiceMock).not.toHaveBeenCalled();
  });

  it("calls the inference sidecar on the default live path", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    const { processBusinessCardImage } = await loadOrchestrator();
    callInferenceServiceMock.mockResolvedValue(createMockDualPipeline());

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(callInferenceServiceMock).toHaveBeenCalledWith(
      "base64-image",
      "image/png",
      25000,
    );
    expect(processWithGeminiMock).not.toHaveBeenCalled();
  });

  it("does not fall back to Gemini when the sidecar is down", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    const { processBusinessCardImage } = await loadOrchestrator();
    isTransientOcrInferenceErrorMock.mockReturnValue(true);
    callInferenceServiceMock.mockRejectedValue(
      new Error("OCR inference service timed out"),
    );

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ローカルOCR推論サービス/);
    expect(processWithGeminiMock).not.toHaveBeenCalled();
  });

  it("uses Gemini only when OCR_PROVIDER=gemini", async () => {
    process.env.OCR_PROVIDER = "gemini";
    const { processBusinessCardImage } = await loadOrchestrator();

    const result = await processBusinessCardImage("base64-image", "image/png", {
      userId: "uid-1",
    });

    expect(result.success).toBe(true);
    expect(processWithGeminiMock).toHaveBeenCalledTimes(1);
    expect(processWithGeminiMock).toHaveBeenCalledWith(
      "base64-image",
      "image/png",
      expect.objectContaining({ userId: "uid-1" }),
    );
    expect(callInferenceServiceMock).not.toHaveBeenCalled();
  });

  it("falls back to Gemini after a transient local failure when opted in", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    process.env.OCR_ENABLE_GEMINI_FALLBACK = "true";
    const { processBusinessCardImage } = await loadOrchestrator();
    isTransientOcrInferenceErrorMock.mockReturnValue(true);
    callInferenceServiceMock.mockRejectedValue(new Error("gateway timeout"));
    processWithGeminiMock.mockResolvedValue({
      success: true,
      contactInfo: { email: "fallback@example.com" },
      processingTime: 10,
    });

    const result = await processBusinessCardImage("base64-image", "image/png", {
      userId: "uid-1",
    });

    expect(result.success).toBe(true);
    expect(result.engine).toBe("gemini");
    expect(processWithGeminiMock).toHaveBeenCalledTimes(1);
    expect(processWithGeminiMock).toHaveBeenCalledWith(
      "base64-image",
      "image/png",
      {
        deadlineAtMs: expect.any(Number),
        userId: "uid-1",
      },
    );
  });

  it("does not send card data to Gemini after a permanent local failure", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    process.env.OCR_ENABLE_GEMINI_FALLBACK = "true";
    const { processBusinessCardImage } = await loadOrchestrator();
    isTransientOcrInferenceErrorMock.mockReturnValue(false);
    callInferenceServiceMock.mockRejectedValue(new Error("invalid payload"));

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/自動送信は行いませんでした/);
    expect(processWithGeminiMock).not.toHaveBeenCalled();
  });

  it("does not start Gemini after the total route budget is exhausted", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    process.env.OCR_ENABLE_GEMINI_FALLBACK = "true";
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValue(28001);
    const { processBusinessCardImage } = await loadOrchestrator();
    isTransientOcrInferenceErrorMock.mockReturnValue(true);
    callInferenceServiceMock.mockRejectedValue(new Error("gateway timeout"));

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/API制限時間/);
    expect(processWithGeminiMock).not.toHaveBeenCalled();
    now.mockRestore();
  });

  it("honors a route deadline that started before OCR dispatch", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    const now = jest.spyOn(Date, "now").mockReturnValue(1000);
    const { processBusinessCardImage } = await loadOrchestrator();
    callInferenceServiceMock.mockResolvedValue(createMockDualPipeline());

    const result = await processBusinessCardImage("base64-image", "image/png", {
      deadlineAtMs: 6000,
    });

    expect(result.success).toBe(true);
    expect(callInferenceServiceMock).toHaveBeenCalledWith(
      "base64-image",
      "image/png",
      5000,
    );
    now.mockRestore();
  });
});
