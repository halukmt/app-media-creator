/**
 * Selection logic of the shared locale selector. Pure functions over locale id strings, so they work
 * for any offered subset and stay testable without React.
 */

/** Keeps only offered locales, in the order of `offered`. */
export function restrictSelection(selection: readonly string[], offered: readonly string[]): string[] {
  return offered.filter((id) => selection.includes(id));
}

/**
 * Selection after the user chose `id`:
 * - single mode: only `id`;
 * - multi mode: `id` toggled, but the last selected locale stays selected (never empty).
 * Ids that are not offered leave the selection unchanged.
 */
export function chooseLocale(
  selection: readonly string[],
  id: string,
  offered: readonly string[],
  multiple: boolean,
): string[] {
  const current = restrictSelection(selection, offered);
  if (!offered.includes(id)) return current;
  if (!multiple) return [id];
  if (current.includes(id)) return current.length > 1 ? current.filter((existing) => existing !== id) : current;
  return restrictSelection([...current, id], offered);
}

export function selectAll(offered: readonly string[]): string[] {
  return [...offered];
}

export function isAllSelected(selection: readonly string[], offered: readonly string[]): boolean {
  return offered.length > 0 && offered.every((id) => selection.includes(id));
}

/**
 * Source locale after the selected locales changed: unchanged while it is still selected,
 * otherwise the first selected locale.
 */
export function sourceLocaleFor(sourceLocale: string, selected: readonly string[]): string {
  return selected.includes(sourceLocale) ? sourceLocale : (selected[0] ?? sourceLocale);
}

/**
 * The selection a localized section starts with when the project's locales change: the previous selection
 * limited to the project, or all project locales when nothing of it is left.
 */
export function selectionForProject(selection: readonly string[], projectLocales: readonly string[]): string[] {
  const kept = restrictSelection(selection, projectLocales);
  return kept.length > 0 ? kept : selectAll(projectLocales);
}
