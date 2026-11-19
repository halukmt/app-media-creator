import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isLocaleId, type LocaleId } from '../locales/index.js';
import { isBackground, type Background } from '../screenshots/backgrounds.js';
import { writeJsonAtomic, type Workspace } from './workspace.js';

/**
 * Settings of the App Store creative assets (product page header, search results, universal image), stored in
 * `<workspace>/creative.json`: the background across the whole image and one short phrase per locale.
 */

export interface CreativeSettings {
  version: 1;
  background: Background;
  phrases: Partial<Record<LocaleId, string>>;
}

const FILE = 'creative.json';
/** Longest phrase in characters: Apple asks for one short localized phrase. Mirrored by the UI. */
export const MAX_PHRASE = 60;

export function defaultCreativeSettings(): CreativeSettings {
  return { version: 1, background: { kind: 'gradient', from: '#003a72', to: '#0079dd', angle: 160 }, phrases: {} };
}

const schema = z.object({
  version: z.literal(1).optional(),
  background: z.custom<Background>(isBackground, { message: 'must be a #rrggbb colour or a gradient of two' }),
  phrases: z.record(z.string(), z.string().max(MAX_PHRASE, `at most ${MAX_PHRASE} characters`)),
});

export type CreativeSettingsValidation = { ok: true; settings: CreativeSettings } | { ok: false; errors: string[] };

/** Validates settings: a background preset shape and phrases for supported locales only (blank phrases are dropped). */
export function validateCreativeSettings(input: unknown): CreativeSettingsValidation {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'settings'}: ${issue.message}`) };
  }
  const errors: string[] = [];
  const phrases: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(parsed.data.phrases)) {
    if (!isLocaleId(locale)) errors.push(`phrases.${locale}: not a supported locale`);
    else if (text.trim()) phrases[locale] = text.normalize('NFC').trim();
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, settings: { version: 1, background: parsed.data.background, phrases } };
}

/** The stored settings, or the defaults when there are none or the file is broken. */
export async function readCreativeSettings(workspace: Workspace): Promise<CreativeSettings> {
  const file = path.join(workspace.root, FILE);
  if (!existsSync(file)) return defaultCreativeSettings();
  try {
    const result = validateCreativeSettings(JSON.parse(await readFile(file, 'utf8')));
    return result.ok ? result.settings : defaultCreativeSettings();
  } catch {
    return defaultCreativeSettings();
  }
}

export async function saveCreativeSettings(workspace: Workspace, input: unknown): Promise<CreativeSettingsValidation> {
  const result = validateCreativeSettings(input);
  if (result.ok) await writeJsonAtomic(path.join(workspace.root, FILE), result.settings);
  return result;
}
