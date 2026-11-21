import { useEffect, useState } from 'react';
import { fetchChecklist } from '../api';
import { cardStatus, type CardStatus } from '../lib/export';

export type OutputStatuses = Map<string, CardStatus>;

/**
 * Validation state per generated file (by output path), from the export checklist of the selected languages, in the
 * card view of `cardStatus` (#64). Loads again when the outputs or the languages change; an older answer never
 * overwrites a newer one.
 */
export function useOutputStatuses(outputs: readonly unknown[], selection: readonly string[]): OutputStatuses {
  const [statuses, setStatuses] = useState<OutputStatuses>(new Map());
  useEffect(() => {
    if (outputs.length === 0 || selection.length === 0) return undefined;
    const controller = new AbortController();
    fetchChecklist(selection, controller.signal)
      .then((checklist) => {
        const map: OutputStatuses = new Map();
        for (const item of checklist.targets.flatMap((t) => t.items)) {
          const card = cardStatus(item);
          for (const file of item.files) map.set(file, card);
        }
        setStatuses(map);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [outputs, selection]);
  return statuses;
}
