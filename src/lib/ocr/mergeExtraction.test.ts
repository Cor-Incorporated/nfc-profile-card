import { createMockDualPipeline } from "@/services/business-card/ocr/mockInference";
import { extractionToContactInfo } from "./contactMapper";
import { mergeDualPipeline } from "./mergeExtraction";
import type { DualPipelineRaw } from "./types";

function withSemantic(
  raw: DualPipelineRaw,
  fields: DualPipelineRaw["semantic"]["fields"],
): DualPipelineRaw {
  return {
    ...raw,
    semantic: {
      ...raw.semantic,
      fields: {
        ...raw.semantic.fields,
        ...fields,
      },
    },
  };
}

describe("mergeDualPipeline", () => {
  it("auto-confirms exact fields when classic OCR and VLM agree", () => {
    const merged = mergeDualPipeline(createMockDualPipeline());

    expect(merged.human_review).toBe(false);
    expect(merged.fields.email).toMatchObject({
      value: "taro.yamada@tapforge.example",
      verified: true,
      human_review: false,
      reason: "classic_and_vlm_agree",
    });
    expect(merged.fields.phone).toMatchObject({
      value: "03-1234-5678",
      human_review: false,
      reason: "classic_and_vlm_agree",
    });
    expect(merged.fields.mobile).toMatchObject({
      value: "090-1234-5678",
      human_review: false,
    });
    expect(merged.fields.postal_code).toMatchObject({
      value: "150-0001",
      human_review: false,
    });
    expect(merged.fields.url).toMatchObject({
      value: "https://tapforge.example",
      human_review: false,
    });
  });

  it("flags human_review and keeps the classic value when VLM disagrees", () => {
    const fixture = createMockDualPipeline();
    const merged = mergeDualPipeline({
      ...fixture,
      classic: {
        ...fixture.classic,
        rawText: `${fixture.classic.rawText}\nother.person@tapforge.example\n06-9999-0000`,
      },
      semantic: {
        ...fixture.semantic,
        fields: {
          ...fixture.semantic.fields,
          email: "other.person@tapforge.example",
          phone: "06-9999-0000",
        },
      },
    });

    expect(merged.human_review).toBe(true);
    expect(merged.fields.email).toMatchObject({
      value: "taro.yamada@tapforge.example",
      human_review: true,
      reason: "classic_and_vlm_disagree",
    });
    expect(merged.fields.phone).toMatchObject({
      value: "03-1234-5678",
      human_review: true,
      reason: "classic_and_vlm_disagree",
    });
  });

  it("rejects a VLM-invented email that is not in PP-OCR raw text", () => {
    const fixture = createMockDualPipeline();
    const merged = mergeDualPipeline({
      ...fixture,
      classic: {
        ...fixture.classic,
        rawText: fixture.classic.rawText.replace(
          "taro.yamada@tapforge.example",
          "",
        ),
      },
      semantic: {
        ...fixture.semantic,
        fields: {
          ...fixture.semantic.fields,
          email: "invented@example.com",
        },
      },
    });

    expect(merged.fields.email).toMatchObject({
      value: "",
      verified: false,
      human_review: true,
      reason: "vlm_unverified_exact_value",
    });
    expect(merged.human_review).toBe(true);
  });

  it("does not let VLM complete a phone number that classic OCR never saw", () => {
    const fixture = createMockDualPipeline();
    const merged = mergeDualPipeline({
      ...fixture,
      classic: {
        ...fixture.classic,
        rawText: fixture.classic.rawText
          .replace("03-1234-5678", "")
          .replace("090-1234-5678", ""),
      },
      semantic: {
        ...fixture.semantic,
        fields: {
          ...fixture.semantic.fields,
          phone: "03-1234-5678",
          mobile: "090-1234-5678",
        },
      },
    });

    expect(merged.fields.phone.value).toBe("");
    expect(merged.fields.phone.human_review).toBe(true);
    expect(merged.fields.mobile.value).toBe("");
    expect(merged.fields.mobile.human_review).toBe(true);
  });

  it("uses the classic parser when VLM leaves an exact field empty", () => {
    const merged = mergeDualPipeline(
      withSemantic(createMockDualPipeline(), {
        email: "",
        url: "",
      }),
    );

    expect(merged.fields.email).toMatchObject({
      value: "taro.yamada@tapforge.example",
      source: "parser",
      verified: true,
      human_review: false,
    });
    expect(merged.fields.url.value).toBe("https://tapforge.example");
  });

  it("keeps VLM name/company/title association without requiring exact-string voting", () => {
    const merged = mergeDualPipeline(
      withSemantic(createMockDualPipeline(), {
        name: "山田 太郎",
        company: "株式会社タップフォージ",
        title: "エンジニア",
      }),
    );

    expect(merged.fields.name).toMatchObject({
      value: "山田 太郎",
      source: "vlm",
      human_review: false,
    });
    expect(merged.fields.company.value).toBe("株式会社タップフォージ");
    expect(merged.fields.title.value).toBe("エンジニア");
  });

  it("maps a confirmed extraction to ContactInfo for vCard download", () => {
    const merged = mergeDualPipeline(createMockDualPipeline());
    const contact = extractionToContactInfo(merged);

    expect(contact.lastName).toBe("山田");
    expect(contact.firstName).toBe("太郎");
    expect(contact.email).toBe("taro.yamada@tapforge.example");
    expect(contact.website).toBe("https://tapforge.example");
    expect(contact.phoneNumbers).toEqual(
      expect.arrayContaining([
        { type: "WORK", number: "03-1234-5678" },
        { type: "MOBILE", number: "090-1234-5678" },
      ]),
    );
    expect(contact.addresses[0]).toMatchObject({
      postalCode: "150-0001",
      address: "東京都渋谷区神宮前1-1-1",
    });
  });

  it("prefers a QR payload when classic OCR missed the URL", () => {
    const fixture = createMockDualPipeline();
    const merged = mergeDualPipeline({
      ...fixture,
      classic: {
        ...fixture.classic,
        rawText: fixture.classic.rawText.replace(
          "https://tapforge.example",
          "",
        ),
      },
      semantic: {
        ...fixture.semantic,
        fields: { ...fixture.semantic.fields, url: "" },
      },
      qr: [{ text: "https://tapforge.example", format: "QRCode" }],
    });

    expect(merged.fields.url).toMatchObject({
      value: "https://tapforge.example",
      reason: "qr_payload",
      verified: true,
      human_review: false,
    });
  });
});
