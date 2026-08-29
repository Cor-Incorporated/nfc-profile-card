import {
  exactValuesEqual,
  extractExactCandidates,
  normalizeExactValue,
  rawContainsValue,
  semanticValueInRaw,
  validateExactField,
} from "./parsers";
import {
  CARD_FIELDS,
  EMPTY_FIELD_DECISION,
  EXACT_FIELDS,
  SEMANTIC_FIELDS,
  type CardField,
  type DualPipelineRaw,
  type ExactField,
  type FieldDecision,
  type FieldDecisionMap,
  type MergedCardExtraction,
} from "./types";

const EXACT_FIELD_SET = new Set<string>(EXACT_FIELDS);

function emptyDecision(): FieldDecision {
  return { ...EMPTY_FIELD_DECISION };
}

function mergeExactField(
  field: ExactField,
  vlmValue: string,
  classicCandidates: string[],
  rawText: string,
): FieldDecision {
  const classicValue = classicCandidates[0] || "";
  const trimmedVlm = vlmValue.trim();
  const vlmValid = trimmedVlm ? validateExactField(field, trimmedVlm) : false;
  const vlmInRaw =
    trimmedVlm !== "" && rawContainsValue(rawText, field, trimmedVlm);

  if (
    classicValue &&
    trimmedVlm &&
    exactValuesEqual(field, classicValue, trimmedVlm)
  ) {
    return {
      value: normalizeExactValue(field, classicValue),
      confidence: 0.96,
      source: "merged",
      verified: true,
      human_review: false,
      reason: "classic_and_vlm_agree",
    };
  }

  if (classicValue && trimmedVlm && vlmValid && vlmInRaw) {
    return {
      value: normalizeExactValue(field, classicValue),
      confidence: 0.35,
      source: "classic",
      verified: true,
      human_review: true,
      reason: "classic_and_vlm_disagree",
    };
  }

  if (classicValue && trimmedVlm && !vlmInRaw) {
    return {
      value: normalizeExactValue(field, classicValue),
      confidence: 0.32,
      source: "classic",
      verified: true,
      human_review: true,
      reason: "vlm_invented_exact_value",
    };
  }

  if (classicValue) {
    return {
      value: normalizeExactValue(field, classicValue),
      confidence: 0.82,
      source: "parser",
      verified: true,
      human_review: false,
      reason: "classic_parser_only",
    };
  }

  if (trimmedVlm && vlmValid && vlmInRaw) {
    return {
      value: normalizeExactValue(field, trimmedVlm),
      confidence: 0.7,
      source: "vlm",
      verified: true,
      human_review: false,
      reason: "vlm_verified_against_raw",
    };
  }

  if (trimmedVlm) {
    return {
      value: "",
      confidence: 0.15,
      source: "vlm",
      verified: false,
      human_review: true,
      reason: "vlm_unverified_exact_value",
    };
  }

  return emptyDecision();
}

function mergeSemanticField(
  field: CardField,
  vlmValue: string,
  rawText: string,
): FieldDecision {
  const trimmed = vlmValue.trim();
  if (!trimmed) {
    return emptyDecision();
  }

  const supportedByOcr = semanticValueInRaw(rawText, trimmed);
  return {
    value: trimmed,
    confidence: supportedByOcr ? 0.88 : 0.62,
    source: "vlm",
    verified: supportedByOcr,
    human_review: false,
    reason: supportedByOcr ? "vlm_supported_by_classic" : "vlm_semantic_only",
  };
}

function applyQrHints(
  fields: FieldDecisionMap,
  qrTexts: string[],
  rawText: string,
): void {
  for (const text of qrTexts) {
    const candidates = extractExactCandidates(`${rawText}\n${text}`);
    for (const field of EXACT_FIELDS) {
      if (fields[field].value || candidates[field].length === 0) continue;
      const value = candidates[field][0];
      fields[field] = {
        value: normalizeExactValue(field, value),
        confidence: 0.9,
        source: "parser",
        verified: true,
        human_review: false,
        reason: "qr_payload",
      };
    }
  }
}

export function mergeDualPipeline(raw: DualPipelineRaw): MergedCardExtraction {
  const rawText = raw.classic.rawText || "";
  const classicCandidates = extractExactCandidates(rawText);
  const fields = {} as FieldDecisionMap;

  for (const field of CARD_FIELDS) {
    const vlmValue = raw.semantic.fields[field] || "";
    if (EXACT_FIELD_SET.has(field)) {
      fields[field] = mergeExactField(
        field as ExactField,
        vlmValue,
        classicCandidates[field as ExactField],
        rawText,
      );
    } else {
      fields[field] = mergeSemanticField(field, vlmValue, rawText);
    }
  }

  applyQrHints(
    fields,
    (raw.qr || []).map((item) => item.text).filter(Boolean),
    rawText,
  );

  const human_review = CARD_FIELDS.some((field) => fields[field].human_review);

  return {
    fields,
    human_review,
    engine: `${raw.classic.engine}+${raw.semantic.engine}`,
    rawText,
  };
}

export function decisionsToPlainFields(
  fields: FieldDecisionMap,
): Record<CardField, string> {
  return CARD_FIELDS.reduce(
    (acc, field) => {
      acc[field] = fields[field].value;
      return acc;
    },
    {} as Record<CardField, string>,
  );
}

export { SEMANTIC_FIELDS };
