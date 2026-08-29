import { createMockDualPipeline } from "./ocr/mockInference";

const processWithGeminiMock = jest.fn();
const callInferenceServiceMock = jest.fn();

async function loadOrchestrator() {
  jest.resetModules();
  processWithGeminiMock.mockReset();
  callInferenceServiceMock.mockReset();

  jest.doMock("@/services/business-card/ocr/geminiProvider", () => ({
    processWithGemini: processWithGeminiMock,
  }));
  jest.doMock("@/services/business-card/ocr/inferenceClient", () => ({
    callInferenceService: callInferenceServiceMock,
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
    jest.dontMock("@/services/business-card/ocr/geminiProvider");
    jest.dontMock("@/services/business-card/ocr/inferenceClient");
    jest.dontMock("@/lib/logger");
  });

  it("uses the local mock pipeline by default and does not call Gemini", async () => {
    process.env.OCR_INFERENCE_MODE = "mock";
    const { processBusinessCardImage } = await loadOrchestrator();

    const result = await processBusinessCardImage("base64-image", "image/png");

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
    );
    expect(processWithGeminiMock).not.toHaveBeenCalled();
  });

  it("does not fall back to Gemini when the sidecar is down", async () => {
    process.env.OCR_INFERENCE_MODE = "live";
    const { processBusinessCardImage } = await loadOrchestrator();
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
    processWithGeminiMock.mockResolvedValue({
      success: true,
      contactInfo: { email: "gemini@example.com" },
      processingTime: 10,
    });

    const result = await processBusinessCardImage("base64-image", "image/png");

    expect(result.success).toBe(true);
    expect(processWithGeminiMock).toHaveBeenCalledTimes(1);
    expect(callInferenceServiceMock).not.toHaveBeenCalled();
  });
});
