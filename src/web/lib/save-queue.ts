/**
 * Saves the latest version of a document, one save at a time. `schedule` remembers a new version; `flush` sends it
 * (after any save still running) and resolves when it is stored. A failed save keeps the version pending — unless a
 * newer one was scheduled meanwhile — and rejects the flush, so callers can stop instead of working on stale data.
 */
export interface SaveQueue<T> {
  schedule(document: T): void;
  flush(): Promise<void>;
  /** True while a version waits to be saved (also after a failed save). */
  hasPending(): boolean;
}

export function createSaveQueue<T>(save: (document: T) => Promise<unknown>, onSaved?: () => void): SaveQueue<T> {
  let pending: { document: T; version: number } | null = null;
  // Every scheduled version gets a number; a failed save may only come back if nothing newer was scheduled since.
  let latestVersion = 0;
  // Settled chain of saves; never stays rejected, so later flushes still run.
  let chain: Promise<void> = Promise.resolve();
  // The latest attempt itself: a flush with nothing new to send waits for it and fails with it, so a save that is
  // still running (started by the debounce timer) cannot fail unnoticed.
  let last: Promise<void> = Promise.resolve();

  return {
    schedule(document) {
      latestVersion += 1;
      pending = { document, version: latestVersion };
    },
    hasPending() {
      return pending !== null;
    },
    flush() {
      const next = pending;
      if (!next) return last;
      pending = null;
      const run = chain.then(async () => {
        try {
          await save(next.document);
          onSaved?.();
        } catch (error) {
          // Keep the unsaved version for the next attempt, unless a newer one was scheduled meanwhile (it may already
          // be saved or queued; restoring this one would later write it back over the newer edits).
          if (pending === null && next.version === latestVersion) pending = next;
          throw error;
        }
      });
      chain = run.catch(() => undefined);
      last = run;
      // Nobody may await `last`; keep an unawaited rejection from being reported as unhandled.
      run.catch(() => undefined);
      return run;
    },
  };
}
