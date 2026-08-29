import {
  LOCAL_DEV_AGGREGATOR_URL,
  PRODUCTION_PPOCR_LAN_URL,
  PRODUCTION_PPOCR_URL,
  PRODUCTION_VLM_LAN_URL,
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
});
