/** Store texts helpers for the UI (pure, tested in Node). Limits and fields come from the catalogue. */

interface SpecLike {
  field: string;
  target: 'apple' | 'google';
  order: number;
  unit: 'characters' | 'bytes';
  max: number;
}

type Texts = Partial<Record<string, Partial<Record<string, string>>>>;

/**
 * Length of a text in the unit of its field, after trimming, as the server counts it: characters are code points (an
 * emoji is one), bytes are UTF-8 bytes (Apple keywords: ü or ş count twice).
 */
export function textLength(spec: Pick<SpecLike, 'unit'>, text: string): number {
  const trimmed = text.trim();
  return spec.unit === 'bytes' ? new TextEncoder().encode(trimmed).length : [...trimmed].length;
}

/** True when the text is longer than its field allows. */
export function isOverLimit(spec: Pick<SpecLike, 'unit' | 'max'>, text: string): boolean {
  return textLength(spec, text) > spec.max;
}

/** The stores to show, in display order (App Store first), with their fields in paste order. */
export function storeGroups<T extends SpecLike>(specs: readonly T[], enabled: { apple: boolean; google: boolean }): { target: 'apple' | 'google'; fields: T[] }[] {
  return (['apple', 'google'] as const)
    .filter((target) => enabled[target])
    .map((target) => ({ target, fields: specs.filter((spec) => spec.target === target).sort((a, b) => a.order - b.order) }));
}

/** The texts with one field of one locale changed; an empty text removes the field. Never mutates `texts`. */
export function withText(texts: Texts, locale: string, field: string, text: string): Texts {
  const fields = { ...texts[locale] };
  if (text === '') delete fields[field];
  else fields[field] = text;
  const next = { ...texts };
  if (Object.keys(fields).length > 0) next[locale] = fields;
  else delete next[locale];
  return next;
}
