const USERNAME_RANDOM_DIGITS = 12;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

export function generateDefaultUsername(): string {
  const bytes = randomBytes(USERNAME_RANDOM_DIGITS);
  return Array.from(bytes, (byte, index) => {
    const digit = byte % 10;
    return index === 0 && digit === 0 ? "1" : String(digit);
  }).join("");
}

export function getUidFallbackUsername(uid: string): string {
  const normalizedUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  return normalizedUid ? `u_${normalizedUid}` : generateDefaultUsername();
}
