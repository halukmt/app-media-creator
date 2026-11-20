import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SaveState } from '../components/SaveStatus';
import { DroppedSaveError, pendingSaves, type SaveSource } from '../lib/pending-saves';
import { SaveDiscardedError, createSaveQueue } from '../lib/save-queue';

const SAVE_DELAY = 600;

export interface AutosaveOptions<T> {
  /** The saved document, as the pending-saves tracker names it (#98, #103). */
  source: SaveSource;
  /** Stores a document. */
  save: (document: T) => Promise<unknown>;
  /** Every pending edit is stored. */
  onSaved?: () => void;
  /**
   * Errors after which every edit not yet sent is dropped (a revision conflict): `flush` then resolves instead of
   * failing, the state is `conflict`, and `onDropped` runs while the page is open (e.g. to load the stored version).
   */
  discardOn?: (error: unknown) => boolean;
  onDropped?: () => Promise<unknown>;
}

export interface Autosave<T> {
  saveState: SaveState;
  /** Takes an edit; it is saved after a short pause, one save at a time. */
  schedule: (next: T) => void;
  /** Sends pending edits now; rejects (and keeps them) when the save fails. */
  flush: () => Promise<void>;
  /** Drops every edit not yet sent (the document changed elsewhere); returns whether anything was dropped. */
  discard: () => boolean;
}

/**
 * Debounced autosave of one document (#101): edits are saved after a short pause, one save at a time. Leaving the page
 * sends a pending edit; that save is tracked, so other pages wait for it and a lost edit is reported (#98). A stored
 * save reports the document as saved, which clears an earlier loss report for it.
 */
export function useAutosave<T>(options: AutosaveOptions<T>): Autosave<T> {
  // The callbacks may change on every render; the queue uses those of the last committed render.
  const current = useRef(options);
  useLayoutEffect(() => {
    current.current = options;
  });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queue] = useState(() =>
    createSaveQueue<T>(
      (document) => current.current.save(document),
      () => {
        setSaveState('saved');
        pendingSaves.reportSaved(current.current.source);
        current.current.onSaved?.();
      },
      { discardOn: (error) => current.current.discardOn?.(error) ?? false },
    ),
  );

  /** Sends pending edits; resolves true when they were dropped, and then runs `onDropped` unless the page is left. */
  const send = useCallback(
    async (open: boolean): Promise<boolean> => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      try {
        await queue.flush();
        return false;
      } catch (error) {
        if (current.current.discardOn?.(error) || error instanceof SaveDiscardedError) {
          setSaveState('conflict');
          // A failing load must not turn the dropped edit into a failed flush: the state already says what happened.
          if (open) await current.current.onDropped?.()?.catch(() => undefined);
          return true;
        }
        setSaveState('failed');
        throw error;
      }
    },
    [queue],
  );

  const flush = useCallback(async (): Promise<void> => {
    await send(true);
  }, [send]);

  // Leaving the section sends a pending edit instead of dropping it; a failed or dropped one is reported (#98).
  useEffect(
    () => () =>
      pendingSaves.track(
        current.current.source,
        send(false).then((dropped) => {
          if (dropped) throw new DroppedSaveError();
        }),
      ),
    [send],
  );

  const schedule = useCallback(
    (next: T) => {
      queue.schedule(next);
      setSaveState('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush().catch(() => undefined), SAVE_DELAY);
    },
    [queue, flush],
  );

  const discard = useCallback(() => {
    const dropped = queue.discard();
    if (dropped) setSaveState('conflict');
    return dropped;
  }, [queue]);

  return { saveState, schedule, flush, discard };
}
