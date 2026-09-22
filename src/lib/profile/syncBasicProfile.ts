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

/** A basic edit's address is complete; keep split fields only when they match. */
export function syncBasicProfileContent(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>,
  replaceAddress = false,
): Record<string, unknown> {
  const content = { ...existing };
  for (const field of SYNC_FIELDS) {
    const value = updates[field];
    if (typeof value === "string" && value !== "") content[field] = value;
  }

  if (replaceAddress && typeof updates.address === "string") {
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

  if (typeof updates.name === "string" && updates.name) {
    const nameParts = updates.name.split(" ");
    content.firstName =
      nameParts.length > 1 ? nameParts.slice(1).join(" ") : nameParts[0] || "";
    content.lastName = nameParts.length > 1 ? nameParts[0] : "";
  }

  return content;
}
