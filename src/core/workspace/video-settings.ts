import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isLocaleId, type LocaleId } from '../locales/index.js';
import { isFrameKind, type FrameKind } from '../screenshots/frames.js';
import { MAX_PHRASE } from './creative-settings.js';
import { writeJsonAtomic, type Workspace } from './workspace.js';

/**
 * Settings of the Video section (#23), stored in `<workspace>/video.json`: the chosen purpose, the trim of the
 * recordings, the text cards of the App Store previews and the options of the device videos. The generators take the
 * same values as request options; the page saves them so they survive a reload.
 */

export const VIDEO_PURPOSES = ['store-preview', 'device-video', 'loop'] as const;
export type VideoPurpose = (typeof VIDEO_PURPOSES)[number];
export const VIDEO_FORMATS = ['vertical', 'landscape', 'square'] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export interface VideoSettings {
  version: 1;
  purpose: VideoPurpose;
  trim: { start?: number; end?: number };
  /** Text cards before and after the App Store preview, per locale. */
  intro: Partial<Record<LocaleId, string>>;
  outro: Partial<Record<LocaleId, string>>;
  cardSeconds: number;
  /** Device videos: formats, frame and one line of text per locale. */
  formats: VideoFormat[];
  frame: FrameKind;
  texts: Partial<Record<LocaleId, string>>;
}

const FILE = 'video.json';
/** Longest text on a card or above a device video, in characters. Mirrored by the UI. */
export const MAX_VIDEO_TEXT = MAX_PHRASE;
export const CARD_SECONDS_RANGE = { min: 1, max: 5, default: 2 } as const;

export function defaultVideoSettings(): VideoSettings {
  return { version: 1, purpose: 'store-preview', trim: {}, intro: {}, outro: {}, cardSeconds: CARD_SECONDS_RANGE.default, formats: [...VIDEO_FORMATS], frame: 'iphone', texts: {} };
}

const seconds = z.number().finite().min(0).max(3600);
const texts = z.record(z.string(), z.string().max(MAX_VIDEO_TEXT, `at most ${MAX_VIDEO_TEXT} characters`));
const schema = z.object({
  version: z.literal(1).optional(),
  purpose: z.enum(VIDEO_PURPOSES),
  trim: z.object({ start: seconds.optional(), end: seconds.optional() }).strict(),
  intro: texts,
  outro: texts,
  cardSeconds: z.number().finite().min(CARD_SECONDS_RANGE.min).max(CARD_SECONDS_RANGE.max),
  formats: z.array(z.enum(VIDEO_FORMATS)).min(1, 'pick at least one format'),
  frame: z.custom<FrameKind>(isFrameKind, { message: 'must be a known device frame' }),
  texts,
});

export type VideoSettingsValidation = { ok: true; settings: VideoSettings } | { ok: false; errors: string[] };

/** Texts for supported locales only, trimmed; blank ones are dropped. */
function localeTexts(name: string, input: Record<string, string>, errors: string[]): Partial<Record<LocaleId, string>> {
  const result: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(input)) {
    if (!isLocaleId(locale)) errors.push(`${name}.${locale}: not a supported locale`);
    else if (text.trim()) result[locale] = text.normalize('NFC').trim();
  }
  return result;
}

export function validateVideoSettings(input: unknown): VideoSettingsValidation {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'settings'}: ${issue.message}`) };
  }
  const data = parsed.data;
  const errors: string[] = [];
  if (data.trim.start !== undefined && data.trim.end !== undefined && data.trim.end <= data.trim.start) errors.push('trim.end: must be after the start');
  const settings: VideoSettings = {
    version: 1,
    purpose: data.purpose,
    trim: { ...(data.trim.start !== undefined ? { start: data.trim.start } : {}), ...(data.trim.end !== undefined ? { end: data.trim.end } : {}) },
    intro: localeTexts('intro', data.intro, errors),
    outro: localeTexts('outro', data.outro, errors),
    cardSeconds: data.cardSeconds,
    formats: VIDEO_FORMATS.filter((format) => data.formats.includes(format)),
    frame: data.frame,
    texts: localeTexts('texts', data.texts, errors),
  };
  return errors.length > 0 ? { ok: false, errors } : { ok: true, settings };
}

/** The stored settings, or the defaults when there are none or the file is broken. */
export async function readVideoSettings(workspace: Workspace): Promise<VideoSettings> {
  const file = path.join(workspace.root, FILE);
  if (!existsSync(file)) return defaultVideoSettings();
  try {
    const result = validateVideoSettings(JSON.parse(await readFile(file, 'utf8')));
    return result.ok ? result.settings : defaultVideoSettings();
  } catch {
    return defaultVideoSettings();
  }
}

export async function saveVideoSettings(workspace: Workspace, input: unknown): Promise<VideoSettingsValidation> {
  const result = validateVideoSettings(input);
  if (result.ok) await writeJsonAtomic(path.join(workspace.root, FILE), result.settings);
  return result;
}
