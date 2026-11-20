import { useEffect, useState } from 'react';
import { fetchChecklist } from '../api';
import type { CheckStatus } from '../lib/export';

export type OutputStatuses = Map<string, { status: CheckStatus; messages: string[] }>;

/**
 * Validation state per generated file (by output path), from the export checklist of the selected languages. Loads
 * again when the outputs or the languages change; an older answer never overwrites a newer one.
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
          const messages = item.messages.filter((m) => m.level !== 'info').map((m) => m.text);
          for (const file of item.files) map.set(file, { status: item.status, messages });
        }
        setStatuses(map);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [outputs, selection]);
  return statuses;
}
