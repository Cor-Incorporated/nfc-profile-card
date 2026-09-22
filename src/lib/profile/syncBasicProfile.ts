import { splitEditedProfileAddress } from "./address";

const SYNC_FIELDS = [
  "name",
  "bio",
  "company",
  "position",
  "email",
  "phone",
  "website",
  "photoURL",
] as const;

/** A basic edit replaces present fields, including explicit empty values. */
export function syncBasicProfileContent(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
  replaceAllFields = false,
): Record<string, unknown> {
  const content = { ...existing };
  if (replaceAllFields) delete content.isInitialPlaceholder;
  for (const field of SYNC_FIELDS) {
    const value = updates[field];
    if (typeof value === "string" && (replaceAllFields || value !== "")) {
      content[field] = value;
    }
  }

  if (replaceAllFields && typeof updates.address === "string") {
    const addressParts = splitEditedProfileAddress(updates.address, existing);
    content.address = addressParts.address;
    if (addressParts.postalCode) {
      content.postalCode = addressParts.postalCode;
    } else {
      delete content.postalCode;
    }
    if (addressParts.city) {
      content.city = addressParts.city;
    } else {
      delete content.city;
    }
  }

  if (replaceAllFields && typeof updates.phone === "string") {
    const primaryPhone =
      typeof existing.phone === "string" ? existing.phone : "";
    const cellPhone =
      typeof existing.cellPhone === "string" ? existing.cellPhone : "";
    const displayedPhone = primaryPhone || cellPhone;
    if (!primaryPhone && cellPhone && updates.phone === cellPhone) {
      content.phone = "";
    } else if (updates.phone !== displayedPhone) {
      content.cellPhone = "";
    }
  }

  if (typeof updates.name === "string" && (replaceAllFields || updates.name)) {
    const nameParts = updates.name.split(" ");
    content.firstName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0] || "";
    content.lastName = nameParts.length > 1 ? nameParts[0] : "";
  }

  return content;
}
