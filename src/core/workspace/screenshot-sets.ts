import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { LOCALE_IDS, isLocaleId, type LocaleId } from '../locales/index.js';
import { isBackground, isCardLayout, type Background, type CardLayout } from '../screenshots/index.js';
import { listInputs, type StoredInput } from './inputs.js';
import { writeJsonAtomic, type Workspace } from './workspace.js';

/**
 * Screenshot sets: per locale, the ordered screenshots of the store listing with their headline and subline.
 * Stored in `<workspace>/screenshots.json`. Reordering moves the texts with their screenshot. A locale without its
 * own set uses the source locale's set (fallback input).
 */

/** Most screenshots one set can hold: the App Store maximum. Google Play takes the first 8 (its catalogue maximum). */
export const MAX_SET_SIZE = 10;
const MAX_TEXT = 200;
const FILE = 'screenshots.json';

export interface ScreenshotEntry {
  /** Workspace-relative path of a screenshot input (of this or another locale). */
  input: string;
  headline: string;
  subline: string;
}

export interface CardStyle {
  layout: CardLayout;
  background: Background;
}

export interface ScreenshotSets {
  version: 1;
  style: CardStyle;
  sets: Partial<Record<LocaleId, ScreenshotEntry[]>>;
}

export function defaultScreenshotSets(): ScreenshotSets {
  return { version: 1, style: { layout: 'text-top', background: { kind: 'gradient', from: '#003a72', to: '#0079dd', angle: 160 } }, sets: {} };
}

const entrySchema = z.object({
  input: z.string().min(1),
  headline: z.string().max(MAX_TEXT),
  subline: z.string().max(MAX_TEXT),
});

const documentSchema = z.object({
  version: z.literal(1).optional(),
  style: z.object({
    layout: z.custom<CardLayout>(isCardLayout, { message: 'unknown layout' }),
    background: z.custom<Background>(isBackground, { message: 'must be a #rrggbb colour or a gradient of two' }),
  }),
  sets: z.record(z.string(), z.array(entrySchema).max(MAX_SET_SIZE, `at most ${MAX_SET_SIZE} screenshots per language`)),
});

export type SetsValidation = { ok: true; sets: ScreenshotSets } | { ok: false; errors: string[] };

/**
 * Validates screenshot sets against the uploaded screenshots: known locales, only existing screenshot inputs, each
 * screenshot at most once per locale, at most 10 per locale, texts up to 200 characters. Never throws.
 */
export function validateScreenshotSets(input: unknown, screenshots: readonly StoredInput[]): SetsValidation {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'screenshots'}: ${issue.message}`) };
  }
  const known = new Set(screenshots.filter((s) => s.kind === 'screenshot').map((s) => s.path));
  const errors: string[] = [];
  const sets: Partial<Record<LocaleId, ScreenshotEntry[]>> = {};
  for (const [locale, entries] of Object.entries(parsed.data.sets)) {
    if (!isLocaleId(locale)) {
      errors.push(`sets.${locale}: not a supported locale`);
      continue;
    }
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      if (!known.has(entry.input)) errors.push(`sets.${locale}.${index}.input: ${entry.input} is not an uploaded screenshot`);
      if (seen.has(entry.input)) errors.push(`sets.${locale}.${index}.input: ${entry.input} is listed twice`);
      seen.add(entry.input);
    });
    sets[locale] = entries.map((entry) => ({ input: entry.input, headline: entry.headline.trim(), subline: entry.subline.trim() }));
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, sets: { version: 1, style: parsed.data.style, sets } };
}

/**
 * Brings stored sets in line with the uploaded screenshots: entries whose screenshot was deleted are dropped, and a
 * locale's own uploads that are in no entry yet are appended (in upload order, without text) while there is room.
 */
export function mergeWithInputs(stored: ScreenshotSets, screenshots: readonly StoredInput[]): ScreenshotSets {
  const existing = new Set(screenshots.map((s) => s.path));
  const sets: Partial<Record<LocaleId, ScreenshotEntry[]>> = {};
  for (const locale of LOCALE_IDS) {
    const kept = (stored.sets[locale] ?? []).filter((entry) => existing.has(entry.input));
    const listed = new Set(kept.map((entry) => entry.input));
    const added = screenshots
      .filter((s) => s.locale === locale && !listed.has(s.path))
      .map((s) => ({ input: s.path, headline: '', subline: '' }));
    const merged = [...kept, ...added].slice(0, MAX_SET_SIZE);
    if (merged.length > 0) sets[locale] = merged;
  }
  return { ...stored, sets };
}

/** The current sets: the stored file (or defaults) merged with the uploaded screenshots. */
export async function readScreenshotSets(workspace: Workspace): Promise<ScreenshotSets> {
  const file = path.join(workspace.root, FILE);
  const screenshots = (await listInputs(workspace)).filter((input) => input.kind === 'screenshot');
  let stored = defaultScreenshotSets();
  if (existsSync(file)) {
    // A broken or outdated file falls back to defaults rather than blocking the section; saving rewrites it.
    let raw: unknown = null;
    try {
      raw = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      raw = null;
    }
    const result = validateScreenshotSets(raw, screenshots);
    if (result.ok) stored = result.sets;
  }
  return mergeWithInputs(stored, screenshots);
}

/** Validates and stores the sets; returns the merged result or the validation errors. */
export async function saveScreenshotSets(workspace: Workspace, input: unknown): Promise<SetsValidation> {
  const screenshots = (await listInputs(workspace)).filter((s) => s.kind === 'screenshot');
  const result = validateScreenshotSets(input, screenshots);
  if (!result.ok) return result;
  await writeJsonAtomic(path.join(workspace.root, FILE), result.sets);
  return { ok: true, sets: mergeWithInputs(result.sets, screenshots) };
}

export interface EffectiveEntry extends ScreenshotEntry {
  /** The screenshot comes from another locale (the source locale) because this locale has none of its own. */
  fallbackInput: boolean;
}

/**
 * The set a locale is generated from: its own set, or the source locale's set when it has none. An entry is marked
 * as fallback input when its screenshot belongs to another locale.
 */
export function effectiveSet(sets: ScreenshotSets, locale: LocaleId, sourceLocale: LocaleId, screenshots: readonly StoredInput[]): EffectiveEntry[] {
  const own = sets.sets[locale];
  const entries = own && own.length > 0 ? own : (sets.sets[sourceLocale] ?? []);
  const localeOf = new Map(screenshots.map((s) => [s.path, s.locale]));
  return entries.map((entry) => ({ ...entry, fallbackInput: localeOf.get(entry.input) !== locale }));
}
