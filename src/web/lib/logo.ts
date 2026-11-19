/** Pure helpers of the Logo section: grouping generated files per asset for the preview grid. */

import { type CheckStatus, isWorseStatus } from './export.js';

/** Longest tagline in characters (MAX_TAGLINE in src/core/workspace/logo-settings.ts; the UI cannot import core). */
export const MAX_TAGLINE = 120;

export interface OutputLike {
  path: string;
  specId: string;
  name: string;
  locale?: string;
  environment?: string;
  width?: number;
  height?: number;
}

export interface OutputGroup<T extends OutputLike> {
  key: string;
  name: string;
  locale?: string;
  environment?: string;
  files: T[];
  /** The largest image of the group (the preview); absent when the group has only documents. */
  largest?: T;
  /** Smallest and largest image width. */
  widths?: [number, number];
}

/**
 * Groups files of the same asset and language (e.g. one launcher icon in five densities) into one preview, so the grid
 * shows assets, not dozens of nearly identical files. Groups keep the order of their first file; images first.
 */
export function groupOutputs<T extends OutputLike>(outputs: readonly T[]): OutputGroup<T>[] {
  const groups = new Map<string, OutputGroup<T>>();
  for (const output of outputs) {
    const key = `${output.specId}|${output.locale ?? ''}|${output.environment ?? ''}`;
    const group = groups.get(key) ?? {
      key,
      name: output.name,
      ...(output.locale ? { locale: output.locale } : {}),
      ...(output.environment ? { environment: output.environment } : {}),
      files: [],
    };
    group.files.push(output);
    groups.set(key, group);
  }
  const list = [...groups.values()].map((group) => {
    const images = group.files.filter((f) => f.width !== undefined);
    if (images.length === 0) return group;
    const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return { ...group, largest: sorted[0]!, widths: [sorted.at(-1)!.width!, sorted[0]!.width!] as [number, number] };
  });
  // All languages of one asset sit next to each other (in the order the asset first appears), so long German and
  // Turkish texts can be compared side by side.
  const specOrder = new Map<string, number>();
  for (const output of outputs) if (!specOrder.has(output.specId)) specOrder.set(output.specId, specOrder.size);
  const bySpec = [...list].sort((a, b) => specOrder.get(a.files[0]!.specId)! - specOrder.get(b.files[0]!.specId)!);
  return [...bySpec.filter((g) => g.largest), ...bySpec.filter((g) => !g.largest)];
}

/** Worst status and the distinct messages of a group's files; undefined while no file has a status yet. */
export function groupStatus(
  files: readonly { path: string }[],
  statuses: ReadonlyMap<string, { status: CheckStatus; messages: string[] }>,
): { status: CheckStatus; messages: string[] } | undefined {
  const found = files.map((f) => statuses.get(f.path)).filter((s): s is { status: CheckStatus; messages: string[] } => s !== undefined);
  if (found.length === 0) return undefined;
  const status = found.reduce<CheckStatus>((worst, s) => (isWorseStatus(s.status, worst) ? s.status : worst), 'ok');
  return { status, messages: [...new Set(found.flatMap((s) => s.messages))] };
}
