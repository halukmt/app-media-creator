/**
 * Saves that a section starts while the user leaves it (#98). The section's editor is gone by then, so nobody awaits
 * them: pages that read the same data (Export, the section opened again) wait for `settled()` first, and a save that
 * fails or is dropped after leaving is reported to the app shell instead of being lost silently. Pure, no React.
 */
import type { SectionId } from './sections.js';

/**
 * What happened to a section's edits: the save after leaving failed, or was dropped because the data changed
 * elsewhere; or a later save in that section worked (the earlier loss is then out of date).
 */
export type SaveOutcome = 'failed' | 'dropped' | 'saved';

export interface PendingSaves {
  /** Tracks a save started while leaving `section`; a rejection is reported to every subscriber. */
  track(section: SectionId, save: Promise<unknown>): void;
  /**
   * Resolves once every save tracked so far has settled, whether it worked or not, or after `maxWait` ms at the
   * latest: a save that never answers must not keep other pages from loading. Never rejects.
   */
  settled(maxWait?: number): Promise<void>;
  /** A section stored its edits: subscribers drop an earlier loss report for it. */
  reportSaved(section: SectionId): void;
  /** Calls `listener` for every outcome reported; returns the unsubscribe function. */
  subscribe(listener: (section: SectionId, outcome: SaveOutcome) => void): () => void;
}

/** A save that was dropped because the stored data changed elsewhere: also a lost edit after leaving. */
export class DroppedSaveError extends Error {
  constructor() {
    super('The change was dropped because the stored data changed elsewhere');
  }
}

const MAX_WAIT = 10_000;

export function createPendingSaves(): PendingSaves {
  const running = new Set<Promise<void>>();
  const listeners = new Set<(section: SectionId, outcome: SaveOutcome) => void>();
  const emit = (section: SectionId, outcome: SaveOutcome) => {
    for (const listener of listeners) listener(section, outcome);
  };
  return {
    track(section, save) {
      const settledSave = save.then(
        () => undefined,
        (error: unknown) => emit(section, error instanceof DroppedSaveError ? 'dropped' : 'failed'),
      );
      running.add(settledSave);
      void settledSave.then(() => running.delete(settledSave));
    },
    settled(maxWait = MAX_WAIT) {
      if (running.size === 0) return Promise.resolve();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, maxWait);
      });
      return Promise.race([Promise.all([...running]).then(() => undefined), timeout]).finally(() => clearTimeout(timer));
    },
    reportSaved(section) {
      emit(section, 'saved');
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The one tracker of the running app. */
export const pendingSaves = createPendingSaves();
