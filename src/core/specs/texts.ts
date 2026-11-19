import type { Target } from './types.js';

/**
 * Store text catalogue: every text field of an App Store and a Google Play listing, with its limit, unit and paste
 * order. Single source for the job contract, the checks, the UI counters and the export layout.
 */

/** Text fields; the job contract names result files after them (`store-texts/<locale>/<field>.md`). */
export const STORE_TEXT_FIELDS = [
  'apple-name',
  'apple-subtitle',
  'apple-promotional-text',
  'apple-description',
  'apple-keywords',
  'apple-whats-new',
  'google-title',
  'google-short-description',
  'google-full-description',
] as const;
export type StoreTextField = (typeof STORE_TEXT_FIELDS)[number];

/**
 * Longest store text a job result or the store texts document may hold. The store limits per field are checked
 * separately and reported, so an AI text slightly over a limit can still be applied and shortened.
 */
export const MAX_STORE_TEXT = 10_000;

/** Stores that have text fields. */
export type TextTarget = Extract<Target, 'apple' | 'google'>;

export interface StoreTextSpec {
  field: StoreTextField;
  target: TextTarget;
  name: string;
  /** Position in the store's form (1-based); the `NN-` prefix of the exported file. */
  order: number;
  /** Exported file name without prefix and extension, e.g. `promotional-text`. */
  fileName: string;
  /** Longest allowed text, in `unit`. */
  max: number;
  /** `bytes`: UTF-8 bytes, as App Store Connect counts keywords. */
  unit: 'characters' | 'bytes';
  /** Shortest allowed text in characters, when the store sets one. */
  min?: number;
  /** The store does not accept the listing without it. */
  required: boolean;
  /** Several lines and paragraphs (description fields). */
  multiline: boolean;
  /** True when the values come from the store's own documentation. */
  verified: boolean;
  sourceUrl: string;
  notes?: string;
}

const APPLE_APP_INFO = 'https://developer.apple.com/help/app-store-connect/reference/app-information/app-information';
const APPLE_VERSION_INFO = 'https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information';
const GOOGLE_LISTING = 'https://support.google.com/googleplay/android-developer/answer/9859152';

export const STORE_TEXT_SPECS: readonly StoreTextSpec[] = Object.freeze([
  { field: 'apple-name', target: 'apple', name: 'App name', order: 1, fileName: 'name', max: 30, unit: 'characters', min: 2, required: true, multiline: false, verified: true, sourceUrl: APPLE_APP_INFO },
  { field: 'apple-subtitle', target: 'apple', name: 'Subtitle', order: 2, fileName: 'subtitle', max: 30, unit: 'characters', required: false, multiline: false, verified: true, sourceUrl: APPLE_APP_INFO, notes: 'Shown below the app name.' },
  {
    field: 'apple-promotional-text', target: 'apple', name: 'Promotional text', order: 3, fileName: 'promotional-text', max: 170, unit: 'characters', required: false, multiline: true, verified: true, sourceUrl: APPLE_VERSION_INFO,
    notes: 'Shown above the description; can change without a new app version.',
  },
  { field: 'apple-description', target: 'apple', name: 'Description', order: 4, fileName: 'description', max: 4000, unit: 'characters', required: true, multiline: true, verified: true, sourceUrl: APPLE_VERSION_INFO, notes: 'Plain text; HTML is not supported.' },
  {
    field: 'apple-keywords', target: 'apple', name: 'Keywords', order: 5, fileName: 'keywords', max: 100, unit: 'bytes', required: true, multiline: false, verified: true, sourceUrl: APPLE_VERSION_INFO,
    notes: 'Separated by commas. Do not repeat the app or company name; names of other apps or companies are not allowed.',
  },
  { field: 'apple-whats-new', target: 'apple', name: "What's new", order: 6, fileName: 'whats-new', max: 4000, unit: 'characters', required: false, multiline: true, verified: true, sourceUrl: APPLE_VERSION_INFO, notes: 'Required for every version after the first.' },
  { field: 'google-title', target: 'google', name: 'App name', order: 1, fileName: 'title', max: 30, unit: 'characters', required: true, multiline: false, verified: true, sourceUrl: GOOGLE_LISTING, notes: 'No emoji, ranking or price words, ALL CAPS only for a brand name.' },
  { field: 'google-short-description', target: 'google', name: 'Short description', order: 2, fileName: 'short-description', max: 80, unit: 'characters', required: true, multiline: false, verified: true, sourceUrl: GOOGLE_LISTING },
  { field: 'google-full-description', target: 'google', name: 'Full description', order: 3, fileName: 'full-description', max: 4000, unit: 'characters', required: true, multiline: true, verified: true, sourceUrl: GOOGLE_LISTING },
] satisfies StoreTextSpec[]);

export function isStoreTextField(value: string): value is StoreTextField {
  return (STORE_TEXT_FIELDS as readonly string[]).includes(value);
}

export function getStoreTextSpec(field: StoreTextField): StoreTextSpec {
  const spec = STORE_TEXT_SPECS.find((entry) => entry.field === field);
  if (!spec) throw new Error(`Unknown store text field: ${field}`);
  return spec;
}

/** The fields of one store in paste order. */
export function storeTextSpecs(target: TextTarget): StoreTextSpec[] {
  return STORE_TEXT_SPECS.filter((spec) => spec.target === target).sort((a, b) => a.order - b.order);
}

/** Length of a text in the unit of its field, after trimming (characters are code points, not UTF-16 units). */
export function storeTextLength(spec: Pick<StoreTextSpec, 'unit'>, text: string): number {
  const trimmed = text.trim();
  return spec.unit === 'bytes' ? new TextEncoder().encode(trimmed).length : [...trimmed].length;
}

export interface StoreTextMessage {
  level: 'error' | 'warning';
  text: string;
}

/** Other texts of the same listing, for the checks that compare fields (e.g. keywords against the name). */
export type StoreTextContext = Partial<Record<StoreTextField, string>>;

const EMOJI = /\p{Extended_Pictographic}/u;

function words(text: string, locale?: string): string[] {
  return text
    .toLocaleLowerCase(locale)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);
}

/**
 * Checks one text against its field: errors for the store's hard limits, warnings for advice that is the same in every
 * language (keyword format, words repeated from name or subtitle, emoji or capitals in the Play title).
 * An empty text gives no message; a missing required field is the listing check's job.
 */
export function checkStoreText(field: StoreTextField, text: string, context: StoreTextContext = {}, locale?: string): StoreTextMessage[] {
  const spec = getStoreTextSpec(field);
  const trimmed = text.trim();
  if (!trimmed) return [];
  const messages: StoreTextMessage[] = [];
  const length = storeTextLength(spec, trimmed);
  if (length > spec.max) messages.push({ level: 'error', text: `${spec.name} has ${length} ${spec.unit}; the store allows ${spec.max}` });
  if (spec.min !== undefined && [...trimmed].length < spec.min) messages.push({ level: 'error', text: `${spec.name} needs at least ${spec.min} characters` });
  if (!spec.multiline && /\n/.test(trimmed)) messages.push({ level: 'error', text: `${spec.name} must be one line` });
  if (spec.unit === 'characters' && /<\/?[a-z][^>]*>/i.test(trimmed) && spec.target === 'apple') {
    messages.push({ level: 'warning', text: `${spec.name}: HTML is not supported and shows as plain text` });
  }

  if (field === 'apple-keywords') {
    if (/,\s/.test(trimmed)) messages.push({ level: 'warning', text: 'Keywords: spaces after commas use up bytes; separate with commas only' });
    const list = trimmed.split(',').map((keyword) => keyword.trim().toLocaleLowerCase(locale)).filter(Boolean);
    const duplicates = [...new Set(list.filter((keyword, index) => list.indexOf(keyword) !== index))];
    if (duplicates.length > 0) messages.push({ level: 'warning', text: `Keywords: listed twice: ${duplicates.join(', ')}` });
    if (trimmed.split(',').some((keyword) => !keyword.trim())) messages.push({ level: 'warning', text: 'Keywords: remove the empty entry between two commas' });
    const named = new Set([...words(context['apple-name'] ?? '', locale), ...words(context['apple-subtitle'] ?? '', locale)]);
    const repeated = [...new Set(list.flatMap((keyword) => words(keyword, locale)).filter((word) => named.has(word)))];
    if (repeated.length > 0) {
      messages.push({ level: 'warning', text: `Keywords: ${repeated.join(', ')} already in the name or subtitle; the store counts them there` });
    }
  }

  if (field === 'google-title') {
    if (EMOJI.test(trimmed)) messages.push({ level: 'warning', text: 'App name: Google Play does not allow emoji in the app name' });
    if (/#\s?1\b/.test(trimmed)) messages.push({ level: 'warning', text: 'App name: Google Play does not allow ranking claims such as "#1"' });
    const letters = trimmed.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 4 && letters === letters.toLocaleUpperCase(locale) && letters !== letters.toLocaleLowerCase(locale)) {
      messages.push({ level: 'warning', text: 'App name: avoid ALL CAPS unless it is your brand name' });
    }
  }
  return messages;
}

/** Messages for one store listing of one locale: every field's check plus missing required fields (errors). */
export function checkStoreListing(target: TextTarget, texts: StoreTextContext, locale?: string): { field: StoreTextField; messages: StoreTextMessage[] }[] {
  return storeTextSpecs(target).map((spec) => {
    const text = texts[spec.field] ?? '';
    const messages = text.trim() ? checkStoreText(spec.field, text, texts, locale) : spec.required ? [{ level: 'error' as const, text: `${spec.name} is required` }] : [];
    return { field: spec.field, messages };
  });
}
