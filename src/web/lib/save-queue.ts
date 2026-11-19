/**
 * Saves the latest version of a document, one save at a time. `schedule` remembers a new version; `flush` sends it
 * (after any save still running) and resolves when it is stored. A failed save keeps the version pending — unless a
 * newer one was scheduled meanwhile — and rejects the flush, so callers can stop instead of working on stale data.
 * Exception: an error matched by `discardOn` (e.g. a conflict), and `discard()`, drop every version not yet sent,
 * including flushes already queued; those flushes reject with `SaveDiscardedError` instead of saving.
 */
export interface SaveQueue<T> {
  schedule(document: T): void;
  flush(): Promise<void>;
  /** True while a version waits to be saved (also after a failed save). */
  hasPending(): boolean;
  /**
   * Drops every version not yet sent, e.g. after a conflict: they are based on data that changed elsewhere. This
   * includes saves already queued behind a running one; none of them reaches `save`. Returns whether anything was
   * dropped.
   */
  discard(): boolean;
}

export interface SaveQueueOptions {
  /**
   * Errors after which every version not yet sent is dropped at once, before the next queued save could start (e.g. a
   * 409 conflict: all of them are based on data that changed elsewhere).
   */
  discardOn?: (error: unknown) => boolean;
}

/** The flush was dropped (by `discard()` or a `discardOn` error) and its version was never sent. */
export class SaveDiscardedError extends Error {
  constructor() {
    super('The changes were dropped because the saved data changed elsewhere');
  }
}

export function createSaveQueue<T>(save: (document: T) => Promise<unknown>, onSaved?: () => void, options: SaveQueueOptions = {}): SaveQueue<T> {
  let pending: { document: T; version: number } | null = null;
  // Every scheduled version gets a number; a failed save may only come back if nothing newer was scheduled since.
  let latestVersion = 0;
  // Settled chain of saves; never stays rejected, so later flushes still run.
  let chain: Promise<void> = Promise.resolve();
  // The latest attempt itself: a flush with nothing new to send waits for it and fails with it, so a save that is
  // still running (started by the debounce timer) cannot fail unnoticed.
  let last: Promise<void> = Promise.resolve();
  // Raised by every drop: a queued run of an earlier generation is skipped instead of sent (#92).
  let generation = 0;
  // Flushes queued behind a running save that have not started yet.
  let waiting = 0;

  const drop = (): boolean => {
    const dropped = pending !== null || waiting > 0;
    pending = null;
    generation += 1;
    // The refused save is settled: a later flush with nothing new must not fail with it again.
    last = Promise.resolve();
    return dropped;
  };

  return {
    schedule(document) {
      latestVersion += 1;
      pending = { document, version: latestVersion };
    },
    hasPending() {
      return pending !== null;
    },
    discard: drop,
    flush() {
      const next = pending;
      if (!next) return last;
      pending = null;
      const queuedIn = generation;
      waiting += 1;
      const run = chain.then(async () => {
        waiting -= 1;
        // Dropped while it waited for an earlier save: never send it, and say so to whoever awaits this flush.
        if (queuedIn !== generation) throw new SaveDiscardedError();
        try {
          await save(next.document);
          onSaved?.();
        } catch (error) {
          if (options.discardOn?.(error)) {
            // Drop everything not yet sent in this same step: the next queued run starts right after this one.
            drop();
            throw error;
          }
          // Keep the unsaved version for the next attempt, unless a newer one was scheduled meanwhile (it may already
          // be saved or queued; restoring this one would later write it back over the newer edits) or it was dropped.
          if (queuedIn === generation && pending === null && next.version === latestVersion) pending = next;
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
