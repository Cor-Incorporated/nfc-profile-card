import type { ExactField, OcrTextBlock } from "./types";

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const POSTAL_MARK_RE = /〒\s*(\d{3}-?\d{4})\b/g;
const POSTAL_STANDALONE_RE = /(?<![0-9-])(\d{3}-\d{4})(?![0-9-])/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
const PHONE_RE =
  /(?:\+81[-\s]?)?(?:0\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{3,4}|\d{2,4}[-.\s]\d{2,4}[-.\s]\d{3,4})/g;

const MOBILE_PREFIXES = ["070", "080", "090", "050"];

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePostalCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return value.trim();
}

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("81") && digits.length >= 11) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

export function formatPhone(digits: string): string {
  if (/^0[789]0\d{8}$/.test(digits) || /^050\d{8}$/.test(digits)) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (/^0\d{9,10}$/.test(digits)) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function normalizeUrl(value: string): string {
  let url = value.trim().replace(/[),.;]+$/, "");
  if (url.toLowerCase().startsWith("www.")) {
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    const normalized = parsed.toString().replace(/\/$/, "");
    return normalized;
  } catch {
    return url.replace(/\/$/, "");
  }
}

export function isValidEmail(value: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value.trim());
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{3}-?\d{4}$/.test(value.trim().replace(/^〒\s*/, ""));
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length >= 10 && digits.length <= 11 && /^0\d+$/.test(digits);
}

export function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(normalizeUrl(value));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isMobilePhone(value: string): boolean {
  const digits = normalizePhone(value);
  return MOBILE_PREFIXES.some((prefix) => digits.startsWith(prefix));
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function extractEmails(rawText: string): string[] {
  return unique((rawText.match(EMAIL_RE) || []).map(normalizeEmail));
}

export function extractPostalCodes(rawText: string): string[] {
  const marked = [...rawText.matchAll(POSTAL_MARK_RE)].map((match) =>
    normalizePostalCode(match[1] || match[0]),
  );
  if (marked.length > 0) {
    return unique(marked);
  }

  const phoneDigits = extractPhones(rawText).map(normalizePhone);
  const standalone = [...rawText.matchAll(POSTAL_STANDALONE_RE)]
    .map((match) => normalizePostalCode(match[1] || match[0]))
    .filter((code) => {
      const digits = code.replace(/\D/g, "");
      return !phoneDigits.some((phone) => phone.includes(digits));
    });

  return unique(standalone);
}

export function extractUrls(rawText: string): string[] {
  return unique((rawText.match(URL_RE) || []).map(normalizeUrl)).filter(
    isValidUrl,
  );
}

export function extractPhones(rawText: string): string[] {
  return unique(
    (rawText.match(PHONE_RE) || [])
      .map((value) => formatPhone(normalizePhone(value)))
      .filter((value) => isValidPhone(value)),
  );
}

export function classifyPhones(rawText: string): {
  phone: string[];
  mobile: string[];
  fax: string[];
} {
  const phones = extractPhones(rawText);
  const fax: string[] = [];
  const mobile: string[] = [];
  const work: string[] = [];

  for (const number of phones) {
    const digits = normalizePhone(number);
    const labeledFax = new RegExp(
      `(?:fax|ファックス|ファクス)[^\\d]{0,12}${digits.slice(0, 4)}`,
      "i",
    ).test(rawText.replace(/\D/g, (ch) => (/\d/.test(ch) ? ch : "")));

    if (labeledFax) {
      fax.push(number);
    } else if (isMobilePhone(number)) {
      mobile.push(number);
    } else {
      work.push(number);
    }
  }

  return { phone: work, mobile, fax };
}

export function extractExactCandidates(
  rawText: string,
): Record<ExactField, string[]> {
  const phones = classifyPhones(rawText);
  return {
    email: extractEmails(rawText),
    phone: phones.phone,
    mobile: phones.mobile,
    fax: phones.fax,
    postal_code: extractPostalCodes(rawText),
    url: extractUrls(rawText),
  };
}

export function rawContainsValue(
  rawText: string,
  field: ExactField,
  value: string,
): boolean {
  if (!value) return false;

  if (field === "email") {
    return rawText.toLowerCase().includes(normalizeEmail(value));
  }

  if (field === "postal_code") {
    const digits = normalizePostalCode(value).replace(/\D/g, "");
    return rawText.replace(/\D/g, "").includes(digits);
  }

  if (field === "url") {
    const normalized = normalizeUrl(value).toLowerCase();
    const compactRaw = rawText.toLowerCase().replace(/\s+/g, "");
    return (
      compactRaw.includes(normalized.replace(/^https?:\/\//, "")) ||
      rawText.toLowerCase().includes(value.toLowerCase())
    );
  }

  const digits = normalizePhone(value);
  return rawText.replace(/\D/g, "").includes(digits);
}

export function semanticValueInRaw(rawText: string, value: string): boolean {
  const needle = value.trim().replace(/\s+/g, "").toLowerCase();
  if (!needle || needle.length < 2) return false;
  const haystack = rawText.replace(/\s+/g, "").toLowerCase();
  return haystack.includes(needle);
}

export function validateExactField(field: ExactField, value: string): boolean {
  switch (field) {
    case "email":
      return isValidEmail(value);
    case "postal_code":
      return isValidPostalCode(value);
    case "url":
      return isValidUrl(value);
    case "phone":
    case "mobile":
    case "fax":
      return isValidPhone(value);
    default:
      return false;
  }
}

export function normalizeExactValue(field: ExactField, value: string): string {
  switch (field) {
    case "email":
      return normalizeEmail(value);
    case "postal_code":
      return normalizePostalCode(value);
    case "url":
      return normalizeUrl(value);
    case "phone":
    case "mobile":
    case "fax":
      return formatPhone(normalizePhone(value));
    default:
      return value.trim();
  }
}

export function exactValuesEqual(
  field: ExactField,
  left: string,
  right: string,
): boolean {
  if (!left || !right) return false;
  if (field === "email" || field === "url" || field === "postal_code") {
    return (
      normalizeExactValue(field, left) === normalizeExactValue(field, right)
    );
  }
  return normalizePhone(left) === normalizePhone(right);
}

export function highestConfidenceBlock(
  blocks: OcrTextBlock[],
  predicate: (text: string) => boolean,
): OcrTextBlock | undefined {
  return blocks
    .filter((block) => predicate(block.text))
    .sort((a, b) => b.confidence - a.confidence)[0];
}
