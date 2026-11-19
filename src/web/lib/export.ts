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
  /** Asset sets (one per asset and language) per status. */
  ok: number;
  warning: number;
  error: number;
  /** Number of generated files across all sets. */
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

export interface AssetGroup<T> {
  /** Unique per asset and environment. */
  key: string;
  specId: string;
  /** Non-production environment of icon variants; absent for production. */
  environment?: string;
  /** Worst status of the group's items. */
  status: CheckStatus;
  items: T[];
}

/**
 * Groups checklist items by asset (spec id), keeping the first-seen order of assets and of the items inside.
 * The group status is the worst item status, so an asset with one missing language shows as an error.
 */
export function groupBySpec<T extends { specId: string; environment?: string; status: CheckStatus }>(items: readonly T[]): AssetGroup<T>[] {
  const groups = new Map<string, AssetGroup<T>>();
  for (const item of items) {
    // Icon variants of an environment are their own asset, next to the production one.
    const key = item.environment ? `${item.specId}|${item.environment}` : item.specId;
    const group = groups.get(key) ?? { key, specId: item.specId, ...(item.environment ? { environment: item.environment } : {}), status: 'ok', items: [] };
    group.items.push(item);
    if (STATUS_ORDER[item.status] < STATUS_ORDER[group.status]) group.status = item.status;
    groups.set(key, group);
  }
  return [...groups.values()];
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
