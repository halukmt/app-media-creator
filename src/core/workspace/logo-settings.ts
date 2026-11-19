import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isHexColor, type HexColor } from '../generators/render.js';
import { isLocaleId, type LocaleId } from '../locales/index.js';
import { writeJsonAtomic, type Workspace } from './workspace.js';

/**
 * Settings of the Logo section, stored in `<workspace>/logo.json`: which packs to generate, the background colour of
 * icons and share images, and the tagline per locale for the share images.
 */

export const LOGO_PACKS = ['app-store', 'google-play', 'web', 'social'] as const;
export type LogoPack = (typeof LOGO_PACKS)[number];

export interface LogoSettings {
  version: 1;
  packs: LogoPack[];
  background: HexColor;
  taglines: Partial<Record<LocaleId, string>>;
}

const FILE = 'logo.json';
/** Longest tagline in characters; mirrored by the UI in src/web/lib/logo.ts. */
export const MAX_TAGLINE = 120;

export function defaultLogoSettings(): LogoSettings {
  return { version: 1, packs: [...LOGO_PACKS], background: '#ffffff', taglines: {} };
}

const schema = z.object({
  version: z.literal(1).optional(),
  packs: z.array(z.enum(LOGO_PACKS)).max(LOGO_PACKS.length),
  background: z.custom<HexColor>(isHexColor, { message: 'must be a colour like #1a2b3c' }),
  taglines: z.record(z.string(), z.string().max(MAX_TAGLINE, `at most ${MAX_TAGLINE} characters`)),
});

export type LogoSettingsValidation = { ok: true; settings: LogoSettings } | { ok: false; errors: string[] };

/** Validates settings: known packs (no duplicates), a #rrggbb background, taglines for supported locales only. */
export function validateLogoSettings(input: unknown): LogoSettingsValidation {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'settings'}: ${issue.message}`) };
  }
  const errors: string[] = [];
  const taglines: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(parsed.data.taglines)) {
    if (!isLocaleId(locale)) errors.push(`taglines.${locale}: not a supported locale`);
    else if (text.trim()) taglines[locale] = text.trim();
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, settings: { version: 1, packs: [...new Set(parsed.data.packs)], background: parsed.data.background, taglines } };
}

/** The stored settings, or the defaults when there are none or the file is broken. */
export async function readLogoSettings(workspace: Workspace): Promise<LogoSettings> {
  const file = path.join(workspace.root, FILE);
  if (!existsSync(file)) return defaultLogoSettings();
  try {
    const result = validateLogoSettings(JSON.parse(await readFile(file, 'utf8')));
    return result.ok ? result.settings : defaultLogoSettings();
  } catch {
    return defaultLogoSettings();
  }
}

export async function saveLogoSettings(workspace: Workspace, input: unknown): Promise<LogoSettingsValidation> {
  const result = validateLogoSettings(input);
  if (result.ok) await writeJsonAtomic(path.join(workspace.root, FILE), result.settings);
  return result;
}
