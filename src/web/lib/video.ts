/** Video section helpers (pure, tested in Node). */

export type VideoPurpose = 'store-preview' | 'device-video' | 'loop';
export const VIDEO_PURPOSES: readonly VideoPurpose[] = ['store-preview', 'device-video', 'loop'];
export const VIDEO_FORMATS = ['vertical', 'landscape', 'square'] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

/** The catalogue entries each purpose writes; the result grid shows these. */
const RESULT_SPECS: Record<VideoPurpose, readonly string[]> = {
  'store-preview': ['apple.preview.iphone', 'apple.preview.ipad'],
  'device-video': ['web.video.vertical', 'web.video.landscape', 'web.video.square'],
  loop: ['apple.creative.header-video', 'apple.creative.search-video'],
};

export function resultSpecs(purpose: VideoPurpose): readonly string[] {
  return RESULT_SPECS[purpose];
}

/** A purpose needs its store turned on in Project: App Store previews and loops the App Store, device videos Web. */
export function purposeAvailable(purpose: VideoPurpose, targets: { apple: { enabled: boolean }; web: { enabled: boolean } }): boolean {
  return purpose === 'device-video' ? targets.web.enabled : targets.apple.enabled;
}

/** Largest trim value in seconds; the stored settings accept nothing beyond it. */
export const MAX_TRIM_SECONDS = 3600;

/**
 * Seconds typed into a field: empty means "not set", otherwise a number from 0 to MAX_TRIM_SECONDS (comma or dot as
 * decimal mark). Returns null for anything else.
 */
export function parseSeconds(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (!/^\d+([.,]\d+)?$/.test(trimmed)) return null;
  const seconds = Number(trimmed.replace(',', '.'));
  return seconds <= MAX_TRIM_SECONDS ? seconds : null;
}

export interface TrimFields {
  start: string;
  end: string;
}

/**
 * The trim from the two fields, or the field errors: each must be seconds from 0, and the end must come after the start.
 * `messages` names the error texts so the module stays free of UI strings.
 */
export function trimFrom(
  fields: TrimFields,
  messages: { invalid: string; order: string },
): { trim: { start?: number; end?: number }; errors: { start?: string; end?: string } } {
  const start = parseSeconds(fields.start);
  const end = parseSeconds(fields.end);
  const errors: { start?: string; end?: string } = {};
  if (start === null) errors.start = messages.invalid;
  if (end === null) errors.end = messages.invalid;
  // Without a start the recording starts at 0, so an end of 0 leaves nothing.
  if (typeof end === 'number' && start !== null && end <= (start ?? 0)) errors.end = messages.order;
  const trim = { ...(typeof start === 'number' ? { start } : {}), ...(typeof end === 'number' ? { end } : {}) };
  return { trim, errors };
}

/** The trim as the two field texts. */
export function trimFields(trim: { start?: number; end?: number }): TrimFields {
  return { start: trim.start === undefined ? '' : String(trim.start), end: trim.end === undefined ? '' : String(trim.end) };
}
