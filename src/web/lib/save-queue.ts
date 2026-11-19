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
  let pending: { document: T } | null = null;
  // Settled chain of saves; never stays rejected, so later flushes still run.
  let chain: Promise<void> = Promise.resolve();

  return {
    schedule(document) {
      pending = { document };
    },
    hasPending() {
      return pending !== null;
    },
    flush() {
      const next = pending;
      if (!next) return chain;
      pending = null;
      const run = chain.then(async () => {
        try {
          await save(next.document);
          onSaved?.();
        } catch (error) {
          // Keep the unsaved version for the next attempt, unless the user already made a newer one.
          if (pending === null) pending = next;
          throw error;
        }
      });
      chain = run.catch(() => undefined);
      return run;
    },
  };
}
