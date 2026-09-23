interface ProfileAddressParts {
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasStoredFullAddressPrefix(
  address: string,
  postalCode: string,
  city: string,
): boolean {
  if (!postalCode) return false;
  const hasMark = address.startsWith("〒");
  const withoutMark = hasMark ? address.slice(1).trimStart() : address;
  if (!withoutMark.startsWith(postalCode)) return false;
  const suffix = withoutMark.slice(postalCode.length);
  if (/^\d/.test(suffix)) return false;
  return city ? suffix.trimStart().startsWith(city) : hasMark;
}

function stripRepeatedFullAddressPrefix(
  address: string,
  postalCode: string,
  city: string,
): string | null {
  if (!postalCode || !city) return null;
  const hasMark = address.startsWith("〒");
  const withoutMark = hasMark ? address.slice(1).trimStart() : address;
  if (!withoutMark.startsWith(postalCode)) return null;
  const suffix = withoutMark.slice(postalCode.length);
  if (/^\d/.test(suffix)) return null;
  const afterPostal = suffix.trimStart();
  if (!afterPostal.startsWith(city)) return null;
  const afterCity = afterPostal.slice(city.length);
  if (!/^[\s,，、]/.test(afterCity)) return null;
  const remaining = afterCity.replace(/^[\s,，、]+/, "");
  // A single postal+city prefix could be literal street text. Remove it only
  // when another complete postal+city prefix immediately follows.
  return hasStoredFullAddressPrefix(remaining, postalCode, city)
    ? remaining
    : null;
}

/** Remove only prefixes already represented by the structured fields. */
export function normalizeProfileAddress(parts: ProfileAddressParts) {
  const postalCode = asText(parts.postalCode).replace(/^〒\s*/, "");
  const city = asText(parts.city);
  let address = asText(parts.address);

  // Older basic-profile saves put complete addresses back in `address` while
  // retaining split fields. Keep the final full address when its city/street
  // boundary cannot be proved from the text alone.
  while (address) {
    const remaining = stripRepeatedFullAddressPrefix(address, postalCode, city);
    if (remaining === null || remaining === address) break;
    address = remaining;
  }

  return { postalCode, city, address };
}

/** Preserve split fields when the edited full address still begins with them. */
export function splitEditedProfileAddress(
  fullAddress: string,
  current: ProfileAddressParts,
) {
  const normalizedCurrent = normalizeProfileAddress(current);
  const { postalCode, city } = normalizedCurrent;
  const address = fullAddress.trim();
  if (!address) return { postalCode: "", city: "", address: "" };
  // A no-op edit already has a known split. Retain it even when the Japanese
  // city and street are joined without a provable text boundary.
  if (address === formatProfileAddress(current)) return normalizedCurrent;

  if (hasStoredFullAddressPrefix(address, postalCode, city)) {
    return { postalCode, city, address };
  }
  return { postalCode: "", city: "", address };
}

export function formatProfileAddress(
  parts: ProfileAddressParts,
  showPostalMark = false,
): string {
  const { postalCode, city, address } = normalizeProfileAddress(parts);
  if (hasStoredFullAddressPrefix(address, postalCode, city)) {
    return showPostalMark && !address.startsWith("〒")
      ? `〒${address}`
      : address;
  }
  const postal = postalCode ? `${showPostalMark ? "〒" : ""}${postalCode}` : "";
  const japaneseCity = /[\u3000-\u9fff]/.test(city);
  const location = japaneseCity
    ? `${city}${address}`
    : [city, address].filter(Boolean).join(" ");
  return [postal, location].filter(Boolean).join(" ");
}

/** Keep ambiguous complete addresses intact in the vCard street field. */
export function profileAddressForVCard(parts: ProfileAddressParts) {
  const normalized = normalizeProfileAddress(parts);
  if (
    hasStoredFullAddressPrefix(
      normalized.address,
      normalized.postalCode,
      normalized.city,
    )
  ) {
    return { postalCode: "", city: "", address: normalized.address };
  }
  return normalized;
}
