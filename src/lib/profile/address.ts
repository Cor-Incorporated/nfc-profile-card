interface ProfileAddressParts {
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function stripCityPrefix(
  address: string,
  city: string,
  postalWasStripped: boolean,
): string | null {
  if (!city || !address.startsWith(city)) return null;
  const rest = address.slice(city.length);
  if (/^[\s,，、]/.test(rest)) return rest.replace(/^[\s,，、]+/, "");
  // Japanese addresses often join the city and street without a separator.
  // Only infer that split after finding the postal code immediately before it.
  if (postalWasStripped && /[\u3000-\u9fff]/.test(city)) return rest;
  return rest === "" ? "" : null;
}

function stripPostalPrefix(
  address: string,
  postalCode: string,
  city: string,
): string | null {
  if (!postalCode) return null;
  const hasMark = address.startsWith("〒");
  const withoutMark = hasMark ? address.slice(1).trimStart() : address;
  if (!withoutMark.startsWith(postalCode)) return null;
  const suffix = withoutMark.slice(postalCode.length);
  if (/^\d/.test(suffix)) return null;
  const rest = suffix.trimStart();
  // A matching city or explicit postal mark distinguishes an old full address
  // from a street whose house number happens to equal the postal code.
  if (
    hasMark ||
    (city && stripCityPrefix(rest, city, true) !== null) ||
    (!city && rest.startsWith(postalCode))
  ) {
    return rest;
  }
  return null;
}

/** Remove only prefixes already represented by the structured fields. */
export function normalizeProfileAddress(parts: ProfileAddressParts) {
  const postalCode = asText(parts.postalCode).replace(/^〒\s*/, "");
  const city = asText(parts.city);
  let address = asText(parts.address);

  // Older basic-profile saves put the complete address back in `address` while
  // retaining `postalCode` and `city`. A later save could do this repeatedly.
  while (address) {
    const before = address;
    const withoutPostal = stripPostalPrefix(address, postalCode, city);
    const postalWasStripped = withoutPostal !== null;
    if (withoutPostal !== null) address = withoutPostal;
    const withoutCity = stripCityPrefix(address, city, postalWasStripped);
    if (withoutCity !== null) address = withoutCity;
    if (address === before) break;
  }

  return { postalCode, city, address };
}

/** Preserve split fields when the edited full address still begins with them. */
export function splitEditedProfileAddress(
  fullAddress: string,
  current: ProfileAddressParts,
) {
  const { postalCode, city } = normalizeProfileAddress({
    postalCode: current.postalCode,
    city: current.city,
  });
  const address = fullAddress.trim();
  if (!address) return { postalCode: "", city: "", address: "" };

  let remainder = address;
  let postalWasStripped = false;
  if (postalCode) {
    const withoutPostal = stripPostalPrefix(remainder, postalCode, city);
    if (withoutPostal === null) return { postalCode: "", city: "", address };
    remainder = withoutPostal;
    postalWasStripped = true;
  }
  if (city) {
    const withoutCity = stripCityPrefix(remainder, city, postalWasStripped);
    if (withoutCity === null) {
      return { postalCode: "", city: "", address };
    }
    remainder = withoutCity;
  }

  return {
    postalCode,
    city,
    address: normalizeProfileAddress({ postalCode, city, address: remainder })
      .address,
  };
}

export function formatProfileAddress(
  parts: ProfileAddressParts,
  showPostalMark = false,
): string {
  const { postalCode, city, address } = normalizeProfileAddress(parts);
  const postal = postalCode ? `${showPostalMark ? "〒" : ""}${postalCode}` : "";
  const japaneseCity = /[\u3000-\u9fff]/.test(city);
  const location = japaneseCity
    ? `${city}${address}`
    : [city, address].filter(Boolean).join(" ");
  return [postal, location].filter(Boolean).join(" ");
}
