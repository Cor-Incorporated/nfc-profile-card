// Firestore's Web and Admin Timestamp objects both expose seconds and
// nanoseconds. Keep the full precision to detect another tab's save.
export function getDesignRevision(value: unknown): string | null {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    const milliseconds = value.getTime();
    return `${Math.floor(milliseconds / 1000)}:${String(
      (milliseconds % 1000) * 1_000_000,
    ).padStart(9, "0")}`;
  }

  if (!value || typeof value !== "object") return null;
  const timestamp = value as { seconds?: unknown; nanoseconds?: unknown };
  if (
    typeof timestamp.seconds !== "number" ||
    typeof timestamp.nanoseconds !== "number" ||
    !Number.isInteger(timestamp.seconds) ||
    !Number.isInteger(timestamp.nanoseconds) ||
    timestamp.nanoseconds < 0 ||
    timestamp.nanoseconds >= 1_000_000_000
  ) {
    return null;
  }
  return `${timestamp.seconds}:${String(timestamp.nanoseconds).padStart(9, "0")}`;
}
