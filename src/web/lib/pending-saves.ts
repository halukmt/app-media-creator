/**
 * Saves that a section starts while the user leaves it (#98). The section's editor is gone by then, so nobody awaits
 * them: pages that read the same data (Export, the section opened again) wait for `settled()` first, and a save that
 * fails or is dropped after leaving is reported to the app shell instead of being lost silently. Pure, no React.
 */
import type { SectionId } from './sections.js';

/**
 * One saved document of a section. A section can save several (Screenshots: the sets and the header image settings),
 * so outcomes are kept per document: a save of one never clears the loss of another (#103).
 */
export interface SaveSource {
  section: SectionId;
  document: string;
}

/**
 * What happened to a document's edits: the save after leaving failed, or was dropped because the data changed
 * elsewhere; or a later save of that document worked (the earlier loss is then out of date).
 */
export type SaveOutcome = 'failed' | 'dropped' | 'saved';

export interface PendingSaves {
  /** Tracks a save started while leaving a section; a rejection is reported to every subscriber. */
  track(source: SaveSource, save: Promise<unknown>): void;
  /**
   * Resolves once every save tracked so far has settled, whether it worked or not, or after `maxWait` ms at the
   * latest: a save that never answers must not keep other pages from loading. Never rejects.
   */
  settled(maxWait?: number): Promise<void>;
  /** A document was stored: subscribers drop an earlier loss report for that document. */
  reportSaved(source: SaveSource): void;
  /** Calls `listener` for every outcome reported; returns the unsubscribe function. */
  subscribe(listener: (source: SaveSource, outcome: SaveOutcome) => void): () => void;
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
  const listeners = new Set<(source: SaveSource, outcome: SaveOutcome) => void>();
  const emit = (source: SaveSource, outcome: SaveOutcome) => {
    for (const listener of listeners) listener(source, outcome);
  };
  return {
    track(source, save) {
      const settledSave = save.then(
        () => undefined,
        (error: unknown) => emit(source, error instanceof DroppedSaveError ? 'dropped' : 'failed'),
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
    reportSaved(source) {
      emit(source, 'saved');
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** The one tracker of the running app. */
export const pendingSaves = createPendingSaves();

/** A document whose last edit was lost after leaving its section. */
export interface LostEdit extends SaveSource {
  reason: Exclude<SaveOutcome, 'saved'>;
}

/**
 * The lost edits after an outcome: a loss replaces the document's earlier entry, a save removes it. A save with nothing
 * to remove returns `lost` itself, so React skips the render (every autosave reports a save).
 */
export function withOutcome<T extends readonly LostEdit[]>(lost: T, source: SaveSource, outcome: SaveOutcome): T | LostEdit[] {
  const others = lost.filter((entry) => entry.document !== source.document || entry.section !== source.section);
  if (outcome === 'saved') return others.length === lost.length ? lost : others;
  return [...others, { ...source, reason: outcome }];
}

/** One message per section, in the order the sections were first reported; a failure wins over a conflict. */
export function lostSections(lost: readonly LostEdit[]): { section: SectionId; reason: LostEdit['reason'] }[] {
  const sections: { section: SectionId; reason: LostEdit['reason'] }[] = [];
  for (const entry of lost) {
    const known = sections.find((item) => item.section === entry.section);
    if (!known) sections.push({ section: entry.section, reason: entry.reason });
    else if (entry.reason === 'failed') known.reason = 'failed';
  }
  return sections;
}
