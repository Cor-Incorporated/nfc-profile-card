import type { DualPipelineRaw } from "@/lib/ocr/types";

/**
 * Deterministic fixture used by OCR_INFERENCE_MODE=mock and unit tests.
 * Values that should auto-confirm appear in both classic raw text and VLM JSON.
 */
export function createMockDualPipeline(
  overrides?: Partial<DualPipelineRaw>,
): DualPipelineRaw {
  const fixture: DualPipelineRaw = {
    classic: {
      engine: "mock",
      rawText: [
        "山田 太郎",
        "ヤマダ タロウ",
        "株式会社タップフォージ",
        "プロダクト部",
        "エンジニア",
        "taro.yamada@tapforge.example",
        "03-1234-5678",
        "090-1234-5678",
        "〒150-0001",
        "東京都渋谷区神宮前1-1-1",
        "https://tapforge.example",
      ].join("\n"),
      blocks: [
        {
          text: "山田 太郎",
          bbox: [40, 20, 220, 60],
          confidence: 0.98,
        },
        {
          text: "taro.yamada@tapforge.example",
          bbox: [40, 180, 360, 210],
          confidence: 0.97,
        },
        {
          text: "03-1234-5678",
          bbox: [40, 220, 220, 250],
          confidence: 0.95,
        },
      ],
    },
    semantic: {
      engine: "mock",
      fields: {
        name: "山田 太郎",
        name_kana: "ヤマダ タロウ",
        company: "株式会社タップフォージ",
        department: "プロダクト部",
        title: "エンジニア",
        email: "taro.yamada@tapforge.example",
        phone: "03-1234-5678",
        mobile: "090-1234-5678",
        fax: "",
        postal_code: "150-0001",
        address: "東京都渋谷区神宮前1-1-1",
        url: "https://tapforge.example",
        social: "",
      },
    },
    qr: [],
  };

  return {
    classic: overrides?.classic ?? fixture.classic,
    semantic: overrides?.semantic ?? fixture.semantic,
    qr: overrides?.qr ?? fixture.qr,
  };
}
