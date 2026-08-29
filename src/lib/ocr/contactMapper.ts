import type { Address, ContactInfo, PhoneNumber } from "@/types/business-card";
import type { FieldDecisionMap, MergedCardExtraction } from "./types";

function splitName(name: string): { lastName: string; firstName: string } {
  const trimmed = name.trim();
  if (!trimmed) return { lastName: "", firstName: "" };

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const token = parts[0];
    if (/^[\u3000-\u9fff]{3,4}$/.test(token)) {
      return { lastName: token.slice(0, 2), firstName: token.slice(2) };
    }
    if (/^[\u3000-\u9fff]{2}$/.test(token)) {
      return { lastName: token.slice(0, 1), firstName: token.slice(1) };
    }
    return { lastName: token, firstName: "" };
  }

  if (/[\u3000-\u9fff]/.test(trimmed)) {
    return { lastName: parts[0], firstName: parts.slice(1).join(" ") };
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function splitKana(nameKana: string): {
  phoneticLastName: string;
  phoneticFirstName: string;
} {
  const { lastName, firstName } = splitName(nameKana);
  return { phoneticLastName: lastName, phoneticFirstName: firstName };
}

function pushPhone(
  phones: PhoneNumber[],
  type: PhoneNumber["type"],
  number: string,
) {
  if (!number) return;
  if (phones.some((item) => item.number === number && item.type === type)) {
    return;
  }
  phones.push({ type, number });
}

export function extractionToContactInfo(
  extraction: MergedCardExtraction,
): ContactInfo {
  const fields = extraction.fields;
  const { lastName, firstName } = splitName(fields.name.value);
  const { phoneticLastName, phoneticFirstName } = splitKana(
    fields.name_kana.value,
  );

  const phoneNumbers: PhoneNumber[] = [];
  pushPhone(phoneNumbers, "WORK", fields.phone.value);
  pushPhone(phoneNumbers, "MOBILE", fields.mobile.value);
  pushPhone(phoneNumbers, "FAX", fields.fax.value);

  const addresses: Address[] = [];
  if (fields.address.value || fields.postal_code.value) {
    addresses.push({
      label: "WORK",
      postalCode: fields.postal_code.value,
      address: fields.address.value,
    });
  }

  const website = fields.url.value || fields.social.value;

  return {
    lastName,
    firstName,
    phoneticLastName,
    phoneticFirstName,
    company: fields.company.value,
    department: fields.department.value,
    title: fields.title.value,
    addresses,
    email: fields.email.value,
    website,
    phoneNumbers,
  };
}

export function reviewFieldsFromDecisions(
  fields: FieldDecisionMap,
): Record<
  string,
  { human_review: boolean; confidence: number; reason?: string }
> {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, decision]) => decision.human_review || decision.value)
      .map(([key, decision]) => [
        key,
        {
          human_review: decision.human_review,
          confidence: decision.confidence,
          reason: decision.reason,
        },
      ]),
  );
}
