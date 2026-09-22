interface VersionedDraft<T> {
  version: number;
  draft: T;
}

// A save includes both the Firestore write and public-page invalidation.
// If the editor changes during either await, persist the newest draft too.
export async function saveLatestVersion<T>(
  readDraft: () => VersionedDraft<T>,
  persist: (draft: T) => Promise<void>,
) {
  while (true) {
    const current = readDraft();
    await persist(current.draft);
    if (readDraft().version === current.version) return;
  }
}
