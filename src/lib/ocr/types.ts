export const EXACT_FIELDS = [
  "email",
  "phone",
  "mobile",
  "fax",
  "postal_code",
  "url",
] as const;

export const SEMANTIC_FIELDS = [
  "name",
  "name_kana",
  "company",
  "department",
  "title",
  "address",
  "social",
] as const;

export const CARD_FIELDS = [...EXACT_FIELDS, ...SEMANTIC_FIELDS] as const;

export type ExactField = (typeof EXACT_FIELDS)[number];
export type SemanticField = (typeof SEMANTIC_FIELDS)[number];
export type CardField = (typeof CARD_FIELDS)[number];

export type OcrProviderName = "local" | "gemini";
export type VlmEngine = "paddleocr-vl-1.6" | "hunyuanocr-1.5";
export type ClassicEngine = "pp-ocrv6-medium";
export type InferenceMode = "live" | "mock";

export type FieldSource = "classic" | "vlm" | "merged" | "parser";

export interface OcrTextBlock {
  text: string;
  bbox: [number, number, number, number];
  confidence: number;
}

export interface ClassicOcrResult {
  engine: ClassicEngine | "mock";
  rawText: string;
  blocks: OcrTextBlock[];
}

export type SemanticCardFields = Partial<Record<CardField, string>>;

export interface SemanticExtraction {
  engine: VlmEngine | "mock";
  fields: SemanticCardFields;
}

export interface QrPayload {
  text: string;
  format?: string;
}

export interface DualPipelineRaw {
  classic: ClassicOcrResult;
  semantic: SemanticExtraction;
  qr?: QrPayload[];
}

export interface FieldDecision {
  value: string;
  confidence: number;
  source: FieldSource;
  verified: boolean;
  human_review: boolean;
  reason?: string;
}

export type FieldDecisionMap = Record<CardField, FieldDecision>;

export interface MergedCardExtraction {
  fields: FieldDecisionMap;
  human_review: boolean;
  engine: string;
  rawText: string;
}

export const EMPTY_FIELD_DECISION: FieldDecision = {
  value: "",
  confidence: 0,
  source: "parser",
  verified: false,
  human_review: false,
};
