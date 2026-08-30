import {
  LOCAL_DEV_AGGREGATOR_URL,
  PRODUCTION_PPOCR_LAN_URL,
  PRODUCTION_PPOCR_URL,
  PRODUCTION_VLM_LAN_URL,
  PRODUCTION_VLM_URL,
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

  it("defaults production engines to ThinkStation 8092/8093, not 8090", () => {
    expect(getVlmUrl()).toBe("http://100.93.32.70:8092/v1");
    expect(getPpocrUrl()).toBe("http://100.93.32.70:8093");
    expect(PRODUCTION_VLM_URL).toBe("http://100.93.32.70:8092/v1");
    expect(PRODUCTION_PPOCR_URL).toBe("http://100.93.32.70:8093");
    for (const url of [PRODUCTION_VLM_URL, PRODUCTION_PPOCR_URL]) {
      expect(url).not.toContain(":8090");
      expect(url).not.toContain(":8080");
      expect(url).not.toContain(":11434");
      expect(url).not.toContain(":8091");
      expect(url).not.toContain(":8188");
      expect(url).not.toContain(":8190");
      expect(url).not.toContain(":50052");
    }
    expect(getInferenceBaseUrl()).toBeUndefined();
    expect(PRODUCTION_VLM_LAN_URL).toBe("http://192.168.11.26:8092/v1");
    expect(PRODUCTION_PPOCR_LAN_URL).toBe("http://192.168.11.26:8093");
  });

  it("treats OCR_INFERENCE_URL as a local-dev aggregator only when set", () => {
    process.env.OCR_INFERENCE_URL = LOCAL_DEV_AGGREGATOR_URL;
    expect(getInferenceBaseUrl()).toBe(LOCAL_DEV_AGGREGATOR_URL);
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
