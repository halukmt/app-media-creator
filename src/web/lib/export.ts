/** Pure helpers for the Export section: checklist summary and the download file name. */

export type CheckStatus = 'ok' | 'warning' | 'error';

export interface ChecklistItemLike {
  status: CheckStatus;
  files: readonly string[];
}

export interface ChecklistLike {
  status: CheckStatus;
  targets: readonly { items: readonly ChecklistItemLike[] }[];
}

export interface ChecklistSummary {
  ok: number;
  warning: number;
  error: number;
  /** Number of generated files across all items. */
  files: number;
}

export function summarizeChecklist(checklist: ChecklistLike): ChecklistSummary {
  const summary: ChecklistSummary = { ok: 0, warning: 0, error: 0, files: 0 };
  for (const target of checklist.targets) {
    for (const item of target.items) {
      summary[item.status] += 1;
      summary.files += item.files.length;
    }
  }
  return summary;
}

const STATUS_ORDER: Record<CheckStatus, number> = { error: 0, warning: 1, ok: 2 };

/** Items with errors first, then warnings, then ok; the original order inside each group. */
export function sortByStatus<T extends { status: CheckStatus }>(items: readonly T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => STATUS_ORDER[a.item.status] - STATUS_ORDER[b.item.status] || a.index - b.index)
    .map(({ item }) => item);
}

/** True when `next` (a status from the server, possibly unknown text) is worse than `shown`. */
export function isWorseStatus(next: string | null, shown: CheckStatus): boolean {
  if (next !== 'ok' && next !== 'warning' && next !== 'error') return false;
  return STATUS_ORDER[next] < STATUS_ORDER[shown];
}

/**
 * File name from a `content-disposition` header (`attachment; filename="x.zip"`). Falls back to `fallback` when the
 * header is missing or names a path; only the base name is ever used.
 */
export function downloadFileName(header: string | null, fallback: string): string {
  const match = header ? /filename="([^"]+)"/.exec(header) : null;
  const name = match?.[1]?.split(/[\\/]/).pop()?.trim();
  return name && name !== '.' && name !== '..' ? name : fallback;
}
