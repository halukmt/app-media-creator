import { useEffect } from 'react';
import { pendingSaves } from '../lib/pending-saves';

/**
 * Runs `load` once on mount (and when it changes), after the saves started by leaving a section have landed (#98):
 * otherwise the load could show the version before them. Skipped when the page is gone by then.
 */
export function useLoadAfterSaves(load: () => unknown): void {
  useEffect(() => {
    let active = true;
    void pendingSaves.settled().then(() => (active ? load() : undefined));
    return () => {
      active = false;
    };
  }, [load]);
}
