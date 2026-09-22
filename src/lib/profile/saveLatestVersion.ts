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
    let failed = false;
    let failure: unknown;
    try {
      await persist(current.draft);
    } catch (error) {
      failed = true;
      failure = error;
    }
    // Even when invalidation fails, a newer draft still needs its own write.
    if (readDraft().version !== current.version) continue;
    if (failed) throw failure;
    return;
  }
}
