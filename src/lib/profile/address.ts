interface ProfileAddressParts {
  postalCode?: unknown;
  city?: unknown;
  address?: unknown;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Remove only prefixes already represented by the structured fields. */
export function normalizeProfileAddress(parts: ProfileAddressParts) {
  const postalCode = asText(parts.postalCode).replace(/^〒\s*/, "");
  const city = asText(parts.city);
  let address = asText(parts.address);

  // Older basic-profile saves put the complete address back in `address` while
  // retaining `postalCode` and `city`. A later save could do this repeatedly.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const before = address;
    if (postalCode) {
      const withoutMark = address.startsWith("〒")
        ? address.slice(1).trimStart()
        : address;
      if (withoutMark.startsWith(postalCode)) {
        const rest = withoutMark.slice(postalCode.length);
        if (!/^\d/.test(rest)) address = rest.trimStart();
      }
    }
    if (city && address.startsWith(city)) {
      address = address.slice(city.length).trimStart();
    }
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

  let remainder =
    postalCode && address.startsWith("〒")
      ? address.slice(1).trimStart()
      : address;
  if (postalCode) {
    if (!remainder.startsWith(postalCode)) {
      return { postalCode: "", city: "", address };
    }
    const rest = remainder.slice(postalCode.length);
    if (/^\d/.test(rest)) return { postalCode: "", city: "", address };
    remainder = rest.trimStart();
  }
  if (city) {
    if (!remainder.startsWith(city)) {
      return { postalCode: "", city: "", address };
    }
    remainder = remainder.slice(city.length).trimStart();
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
