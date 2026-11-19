import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { isConflict, messagesOf } from '../api';
import type { SaveState } from '../components/SaveStatus';
import { SaveDiscardedError, createSaveQueue } from '../lib/save-queue';

const SAVE_DELAY = 600;

export interface RevisionAutosaveOptions<T extends { revision: number }, L> {
  /** Loads the stored state; may bring more than the document (e.g. the uploads next to the screenshot sets). */
  load: () => Promise<L>;
  /** The revisioned document inside a load answer. */
  documentOf: (loaded: L) => T;
  /** Stores a document; the hook sets `revision` to the version this page last saw. Answers with the stored document. */
  save: (document: T) => Promise<T>;
  /** Every answer of the newest load, also when its document is older than a save this page already made. */
  onLoaded?: (loaded: L) => void;
  /** The server's version of the document: a newer load or the answer of a save. */
  onServerDocument?: (document: T) => void;
  /** A load brought a revision saved elsewhere (another tab, an AI apply). */
  onChangedElsewhere?: () => void;
  /** Every pending edit is stored. */
  onSaved?: () => void;
}

export interface RevisionAutosave<T> {
  /** The document as the page shows it (with edits not yet stored); null until the first load. */
  document: T | null;
  saveState: SaveState;
  /** Messages of a failed load (empty without server messages); null when the last load worked. */
  loadError: string[] | null;
  /** Edits are paused around an AI apply until the applied version is shown. */
  editsLocked: boolean;
  /** Takes an edit and saves it after a short pause; false while edits are paused (the edit is not taken). */
  update: (next: T) => boolean;
  /** Sends pending edits now; rejects (and keeps them) when the save fails; drops them on a conflict and reloads. */
  flush: () => Promise<void>;
  /** Loads the stored state; resolves false when that failed (shown as `loadError`). */
  reload: () => Promise<boolean>;
  /**
   * Runs an apply that changes the stored document on the server (e.g. AI texts) under the edit lock: pending edits are
   * sent first, no edit is taken until a reload started after the apply has brought its result. Resolves false, without
   * running the apply, when the pending edits could not be saved.
   */
  applyLocked: (apply: () => Promise<void>) => Promise<boolean>;
}

/**
 * Autosave for a document with a revision (#85): edits are saved after a short pause, one save at a time, each based
 * on the revision this page last saw. The server refuses a save based on an older revision (409); then every edit not
 * yet sent is dropped (#92) and the stored version is loaded. Loads are numbered, so a late answer never overwrites a
 * newer one, and an answer older than the page's own last save is ignored. Leaving the page sends a pending edit.
 */
export function useRevisionAutosave<T extends { revision: number }, L = T>(options: RevisionAutosaveOptions<T, L>): RevisionAutosave<T> {
  // The callbacks may change on every render; the queue and the loads use those of the last committed render.
  const current = useRef(options);
  useLayoutEffect(() => {
    current.current = options;
  });

  const [document, setDocument] = useState<T | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [loadError, setLoadError] = useState<string[] | null>(null);
  const knownRevision = useRef(0);
  const reloadCount = useRef(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Edit lock around an apply (#84, #87). Edits are refused while
  // - an apply runs (`applyRunning`), or
  // - the server holds applied data the page has not shown yet (`lockedAfter` = the last reload number started before
  //   the apply finished; only a successful reload started later can bring it).
  // The lock is released only after such a reload is rendered, so no handler of an earlier render can save old data.
  const applyRunning = useRef(false);
  const lockedAfter = useRef<number | null>(null);
  const [releaseLock, setReleaseLock] = useState(false);
  const [editsLocked, setEditsLocked] = useState(false);

  const [queue] = useState(() =>
    createSaveQueue<T>(
      async (next) => {
        const saved = await current.current.save({ ...next, revision: knownRevision.current });
        // Never backwards: a reload may already have seen a newer revision than this save's answer, and then the
        // page already shows that newer server version.
        if (saved.revision >= knownRevision.current) {
          knownRevision.current = saved.revision;
          current.current.onServerDocument?.(saved);
        }
        return saved;
      },
      () => {
        setSaveState('saved');
        current.current.onSaved?.();
      },
      // A conflict drops every edit not yet sent, also those already queued behind it (#92).
      { discardOn: isConflict },
    ),
  );

  const reload = useCallback(async (): Promise<boolean> => {
    const number = (reloadCount.current += 1);
    try {
      const loaded = await current.current.load();
      if (number !== reloadCount.current) return false;
      current.current.onLoaded?.(loaded);
      const next = current.current.documentOf(loaded);
      // An answer older than a save this page already made is stale.
      if (next.revision >= knownRevision.current) {
        if (next.revision > knownRevision.current) {
          // The document moved on elsewhere: an edit still waiting is based on the older version and must not be sent.
          if (queue.discard()) setSaveState('conflict');
          current.current.onChangedElsewhere?.();
        }
        knownRevision.current = next.revision;
        setDocument(next);
        current.current.onServerDocument?.(next);
      }
      setLoadError(null);
      // This reload started after the apply finished, so it shows the applied data: release once it is rendered.
      if (!applyRunning.current && lockedAfter.current !== null && number > lockedAfter.current) setReleaseLock(true);
      return true;
    } catch (error) {
      if (number === reloadCount.current) setLoadError(messagesOf(error));
      return false;
    }
  }, [queue]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const flush = useCallback(async (): Promise<void> => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await queue.flush();
    } catch (error) {
      if (isConflict(error) || error instanceof SaveDiscardedError) {
        // The queue already dropped everything not yet sent (never retried: it is based on data that changed
        // elsewhere). Show the current version; the caller (upload, generate, apply) goes on once it is loaded.
        setSaveState('conflict');
        await reload();
        return;
      }
      setSaveState('failed');
      throw error;
    }
  }, [queue, reload]);
  // Leaving the section sends a pending edit instead of dropping it.
  useEffect(() => () => void flush().catch(() => undefined), [flush]);

  const update = useCallback(
    (next: T): boolean => {
      if (applyRunning.current || lockedAfter.current !== null) return false;
      setDocument(next);
      queue.schedule(next);
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush().catch(() => undefined), SAVE_DELAY);
      return true;
    },
    [queue, flush],
  );

  useEffect(() => {
    if (!releaseLock) return;
    setReleaseLock(false);
    if (applyRunning.current) return;
    lockedAfter.current = null;
    setEditsLocked(false);
  }, [releaseLock]);

  const applyLocked = useCallback(
    async (apply: () => Promise<void>): Promise<boolean> => {
      // From here until the reloaded document is rendered, no edit may queue a save (see update).
      applyRunning.current = true;
      setEditsLocked(true);
      try {
        await flush();
      } catch {
        // Nothing was sent: the page is as before. Only an earlier apply that still waits for its reload keeps edits
        // paused, and that reload is tried now (#89).
        applyRunning.current = false;
        setEditsLocked(lockedAfter.current !== null);
        if (lockedAfter.current !== null) void reload();
        return false;
      }
      let failure: { error: unknown } | null = null;
      try {
        await apply();
      } catch (error) {
        failure = { error };
      } finally {
        // Also after an error: the server may have stored the result before the answer was lost. Only a reload
        // started from now on shows the server's state and may release the lock.
        lockedAfter.current = reloadCount.current;
        applyRunning.current = false;
      }
      // Releases the lock when it succeeds; when it fails, the lock stays until a later reload succeeds (#87).
      await reload();
      if (failure) throw failure.error;
      return true;
    },
    [flush, reload],
  );

  return { document, saveState, loadError, editsLocked, update, flush, reload, applyLocked };
}
