import {
  LOCAL_DEV_AGGREGATOR_URL,
  getGeminiFallbackTimeoutMs,
  getInferenceBaseUrl,
  getInferenceTimeoutMs,
  getOcrTotalTimeoutMs,
  getPpocrUrl,
  getVlmUrl,
} from "./config";

describe("OCR inference URLs", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    delete process.env.OCR_INFERENCE_URL;
    delete process.env.OCR_PPOCR_URL;
    delete process.env.OCR_VLM_URL;
    delete process.env.OCR_ENABLE_GEMINI_FALLBACK;
    delete process.env.OCR_INFERENCE_TIMEOUT_MS;
    delete process.env.OCR_TOTAL_TIMEOUT_MS;
    delete process.env.OCR_GEMINI_FALLBACK_TIMEOUT_MS;
  });

  it("does not default a production request to private engine endpoints", () => {
    expect(getInferenceBaseUrl()).toBeUndefined();
    expect(() => getVlmUrl()).toThrow(/OCR_VLM_URL/);
    expect(() => getPpocrUrl()).toThrow(/OCR_PPOCR_URL/);
  });

  it("treats OCR_INFERENCE_URL as a local-dev aggregator only when set", () => {
    process.env.OCR_INFERENCE_URL = LOCAL_DEV_AGGREGATOR_URL;
    expect(getInferenceBaseUrl()).toBe(LOCAL_DEV_AGGREGATOR_URL);
  });

  it("allows direct engine URLs only when explicitly configured", () => {
    process.env.OCR_VLM_URL = "http://127.0.0.1:8092/v1/";
    process.env.OCR_PPOCR_URL = "http://127.0.0.1:8093/";

    expect(getVlmUrl()).toBe("http://127.0.0.1:8092/v1");
    expect(getPpocrUrl()).toBe("http://127.0.0.1:8093");
  });

  it("keeps the existing local timeout when Gemini fallback is disabled", () => {
    expect(getInferenceTimeoutMs()).toBe(25000);
  });

  it("reserves enough of the route deadline for a Gemini fallback", () => {
    process.env.OCR_ENABLE_GEMINI_FALLBACK = "true";
    process.env.OCR_INFERENCE_TIMEOUT_MS = "25000";

    expect(getOcrTotalTimeoutMs()).toBe(28000);
    expect(getGeminiFallbackTimeoutMs()).toBe(18000);
    expect(getInferenceTimeoutMs()).toBe(9000);
  });

  it("fails closed when configured budgets starve local inference", () => {
    process.env.OCR_ENABLE_GEMINI_FALLBACK = "true";
    process.env.OCR_TOTAL_TIMEOUT_MS = "60000";
    process.env.OCR_GEMINI_FALLBACK_TIMEOUT_MS = "50000";
    process.env.OCR_INFERENCE_TIMEOUT_MS = "50000";

    expect(getOcrTotalTimeoutMs()).toBe(28000);
    expect(getGeminiFallbackTimeoutMs()).toBe(27000);
    expect(() => getInferenceTimeoutMs()).toThrow(/at least 3000ms/);
  });
});
