const USERNAME_RANDOM_BYTES = 8;

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

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function generateDefaultUsername(): string {
  return `user_${toHex(randomBytes(USERNAME_RANDOM_BYTES))}`;
}

export function getUidFallbackUsername(uid: string): string {
  const normalizedUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  return normalizedUid ? `u_${normalizedUid}` : generateDefaultUsername();
}
