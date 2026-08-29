import {
  LOCAL_DEV_AGGREGATOR_URL,
  PRODUCTION_PPOCR_URL,
  PRODUCTION_VLM_URL,
  getInferenceBaseUrl,
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
  });

  it("defaults production engines to ThinkStation 8092/8093, not 8090", () => {
    expect(getVlmUrl()).toBe(PRODUCTION_VLM_URL);
    expect(getPpocrUrl()).toBe(PRODUCTION_PPOCR_URL);
    expect(PRODUCTION_VLM_URL).toContain(":8092");
    expect(PRODUCTION_PPOCR_URL).toContain(":8093");
    expect(PRODUCTION_VLM_URL).not.toContain(":8090");
    expect(PRODUCTION_PPOCR_URL).not.toContain(":8090");
    expect(getInferenceBaseUrl()).toBeUndefined();
  });

  it("treats OCR_INFERENCE_URL as a local-dev aggregator only when set", () => {
    process.env.OCR_INFERENCE_URL = LOCAL_DEV_AGGREGATOR_URL;
    expect(getInferenceBaseUrl()).toBe(LOCAL_DEV_AGGREGATOR_URL);
  });
});
