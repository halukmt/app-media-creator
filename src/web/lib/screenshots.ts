/**
 * Pure helpers of the Screenshots section: editing a screenshot set and mapping style overrides to option ids.
 * Types are structural so the helpers stay independent of the API client.
 */

export interface EntryLike {
  input: string;
  layout?: string;
  background?: BackgroundLike;
  frame?: 'device' | 'none';
}

export type BackgroundLike = { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number };

/** Option id meaning "use the section style". */
export const INHERIT = 'inherit';

/** Moves the entry at `index` one step up (-1) or down (+1); out-of-range moves return the list unchanged. */
export function moveEntry<T>(entries: readonly T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (index < 0 || index >= entries.length || target < 0 || target >= entries.length) return [...entries];
  const next = [...entries];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function removeEntry<T>(entries: readonly T[], index: number): T[] {
  return entries.filter((_, i) => i !== index);
}

/** Stable key of a background, used as its option id. */
export function backgroundKey(background: BackgroundLike): string {
  return background.kind === 'solid' ? `solid:${background.color}` : `gradient:${background.from}:${background.to}:${background.angle}`;
}

/** Option ids for a slot's overrides; `inherit` where the slot uses the section style. */
export function overrideIds(entry: EntryLike): { layout: string; background: string; frame: string } {
  return {
    layout: entry.layout ?? INHERIT,
    background: entry.background ? backgroundKey(entry.background) : INHERIT,
    frame: entry.frame ?? INHERIT,
  };
}

/**
 * Applies chosen option ids to an entry: `inherit` removes the override, other ids set it. Background ids are looked
 * up in `backgrounds`; an unknown id leaves the background unchanged.
 */
export function applyOverrides<T extends EntryLike>(
  entry: T,
  ids: Partial<{ layout: string; background: string; frame: string }>,
  backgrounds: readonly BackgroundLike[],
): T {
  const next: T = { ...entry };
  if (ids.layout !== undefined) {
    if (ids.layout === INHERIT) delete next.layout;
    else next.layout = ids.layout;
  }
  if (ids.background !== undefined) {
    if (ids.background === INHERIT) delete next.background;
    else {
      const found = backgrounds.find((b) => backgroundKey(b) === ids.background);
      if (found) next.background = found;
    }
  }
  if (ids.frame !== undefined) {
    if (ids.frame === INHERIT) delete next.frame;
    else if (ids.frame === 'device' || ids.frame === 'none') next.frame = ids.frame;
  }
  return next;
}

/** Display name of an uploaded file: the original name without the upload prefix. */
export function uploadName(inputPath: string): string {
  const base = inputPath.split('/').pop() ?? inputPath;
  return base.replace(/^\d+-[0-9a-f]{6}-/, '');
}

/** CSS background for a swatch: the colour data of a background (not UI styling). */
export function swatchCss(background: BackgroundLike): string {
  return background.kind === 'solid' ? background.color : `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
}
