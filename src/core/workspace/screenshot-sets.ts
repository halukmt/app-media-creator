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
  /** Per-slot overrides of the card style; absent means the project style. */
  layout?: CardLayout;
  background?: Background;
  /** `device`: the device's default frame (none on Google Play); `none`: no frame for this slot. */
  frame?: SlotFrame;
}

export type SlotFrame = 'device' | 'none';

export interface CardStyle {
  layout: CardLayout;
  background: Background;
}

export interface ScreenshotSets {
  version: 1;
  /**
   * Counts the stored versions. A save names the revision it is based on and is rejected when the file has moved on
   * (another tab, an AI apply), so an older document never overwrites newer changes.
   */
  revision: number;
  style: CardStyle;
  sets: Partial<Record<LocaleId, ScreenshotEntry[]>>;
  /**
   * Screenshots the sets have already seen. Only uploads that are not in this list are appended automatically, so a
   * screenshot the user took out of a set stays out.
   */
  known: string[];
}

export function defaultScreenshotSets(): ScreenshotSets {
  return {
    version: 1,
    revision: 0,
    style: { layout: 'text-top', background: { kind: 'gradient', from: '#003a72', to: '#0079dd', angle: 160 } },
    sets: {},
    known: [],
  };
}

/** The uploaded screenshots (all locales). */
export async function listScreenshots(workspace: Workspace): Promise<StoredInput[]> {
  return (await listInputs(workspace)).filter((input) => input.kind === 'screenshot');
}

const entrySchema = z.object({
  input: z.string().min(1),
  headline: z.string().max(MAX_TEXT),
  subline: z.string().max(MAX_TEXT),
  layout: z.custom<CardLayout>(isCardLayout, { message: 'unknown layout' }).optional(),
  background: z.custom<Background>(isBackground, { message: 'must be a #rrggbb colour or a gradient of two' }).optional(),
  frame: z.enum(['device', 'none']).optional(),
});

const documentSchema = z.object({
  version: z.literal(1).optional(),
  revision: z.number().int().min(0).optional(),
  style: z.object({
    layout: z.custom<CardLayout>(isCardLayout, { message: 'unknown layout' }),
    background: z.custom<Background>(isBackground, { message: 'must be a #rrggbb colour or a gradient of two' }),
  }),
  sets: z.record(z.string(), z.array(entrySchema).max(MAX_SET_SIZE, `at most ${MAX_SET_SIZE} screenshots per language`)),
  known: z.array(z.string()).optional(),
});

export type SetsValidation = { ok: true; sets: ScreenshotSets } | { ok: false; errors: string[]; conflict?: true };

/**
 * Validates screenshot sets against the uploaded screenshots: known locales, only existing screenshot inputs, each
 * screenshot at most once per locale, at most 10 per locale, texts up to 200 characters. Never throws.
 * `lenient` (for the stored file): entries of deleted screenshots and unknown locales are dropped instead of rejected,
 * so deleting one upload never loses the other texts and the style.
 */
export function validateScreenshotSets(input: unknown, screenshots: readonly StoredInput[], lenient = false): SetsValidation {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'screenshots'}: ${issue.message}`) };
  }
  const uploaded = new Set(screenshots.map((s) => s.path));
  const errors: string[] = [];
  const sets: Partial<Record<LocaleId, ScreenshotEntry[]>> = {};
  for (const [locale, entries] of Object.entries(parsed.data.sets)) {
    if (!isLocaleId(locale)) {
      if (!lenient) errors.push(`sets.${locale}: not a supported locale`);
      continue;
    }
    const seen = new Set<string>();
    const kept: ScreenshotEntry[] = [];
    entries.forEach((entry, index) => {
      const problem = !uploaded.has(entry.input) ? 'is not an uploaded screenshot' : seen.has(entry.input) ? 'is listed twice' : null;
      seen.add(entry.input);
      if (problem) {
        if (!lenient) errors.push(`sets.${locale}.${index}.input: ${entry.input} ${problem}`);
        return;
      }
      kept.push({
        input: entry.input,
        headline: entry.headline.trim(),
        subline: entry.subline.trim(),
        ...(entry.layout ? { layout: entry.layout } : {}),
        ...(entry.background ? { background: entry.background } : {}),
        ...(entry.frame ? { frame: entry.frame } : {}),
      });
    });
    sets[locale] = kept;
  }
  if (errors.length > 0) return { ok: false, errors };
  const known = (parsed.data.known ?? []).filter((p) => uploaded.has(p));
  return { ok: true, sets: { version: 1, revision: parsed.data.revision ?? 0, style: parsed.data.style, sets, known } };
}

/**
 * Brings stored sets in line with the uploaded screenshots: entries whose screenshot was deleted are dropped, and new
 * uploads of a locale (not yet known) are appended in upload order, without text, while there is room.
 */
export function mergeWithInputs(stored: ScreenshotSets, screenshots: readonly StoredInput[]): ScreenshotSets {
  const existing = new Set(screenshots.map((s) => s.path));
  const known = new Set(stored.known);
  const sets: Partial<Record<LocaleId, ScreenshotEntry[]>> = {};
  for (const locale of LOCALE_IDS) {
    const kept = (stored.sets[locale] ?? []).filter((entry) => existing.has(entry.input));
    const listed = new Set(kept.map((entry) => entry.input));
    const added = screenshots
      .filter((s) => s.locale === locale && !listed.has(s.path) && !known.has(s.path))
      .map((s) => ({ input: s.path, headline: '', subline: '' }));
    const merged = [...kept, ...added].slice(0, MAX_SET_SIZE);
    if (merged.length > 0) sets[locale] = merged;
  }
  return { ...stored, sets, known: screenshots.map((s) => s.path) };
}

/**
 * The stored sets as read (lenient: a deleted upload drops only its own entry), or the defaults with revision 0 when
 * there is no file or it is broken as a whole. Reading and saving use this one view, so both see the same revision.
 */
async function readStoredSets(workspace: Workspace, uploads: readonly StoredInput[]): Promise<ScreenshotSets> {
  const file = path.join(workspace.root, FILE);
  if (!existsSync(file)) return defaultScreenshotSets();
  let raw: unknown = null;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    raw = null;
  }
  const result = validateScreenshotSets(raw, uploads, true);
  return result.ok ? result.sets : defaultScreenshotSets();
}

/** The current sets: the stored file (or defaults) merged with the uploaded screenshots. */
export async function readScreenshotSets(workspace: Workspace, screenshots?: readonly StoredInput[]): Promise<ScreenshotSets> {
  const uploads = screenshots ?? (await listScreenshots(workspace));
  return mergeWithInputs(await readStoredSets(workspace, uploads), uploads);
}

// Saves of one workspace run one after another, so two saves based on the same revision cannot both pass the check.
const saveQueues = new Map<string, Promise<unknown>>();

/**
 * Validates and stores the sets; returns the merged result or the validation errors. When the input names a
 * `revision`, it must be the stored one: otherwise nothing is written and the result is a conflict. Each save stores
 * the next revision. (Internal callers that just read the sets pass their revision along; the HTTP route requires one.)
 * Uploads the saving page knew (its `known` list) and those already known stay known, so a screenshot left out of the
 * saved sets is not appended again; an upload the page never saw is still appended on the next read.
 */
export function saveScreenshotSets(workspace: Workspace, input: unknown): Promise<SetsValidation> {
  const run = async (): Promise<SetsValidation> => {
    const screenshots = await listScreenshots(workspace);
    const result = validateScreenshotSets(input, screenshots);
    if (!result.ok) return result;
    const stored = await readStoredSets(workspace, screenshots);
    const based = (input as { revision?: unknown }).revision;
    if (typeof based === 'number' && based !== stored.revision) {
      return {
        ok: false,
        conflict: true,
        errors: [`The screenshot sets were changed elsewhere (revision ${stored.revision}); this save is based on revision ${based}`],
      };
    }
    const listed = Object.values(result.sets.sets).flatMap((entries) => (entries ?? []).map((entry) => entry.input));
    const known = [...new Set([...stored.known, ...result.sets.known, ...listed])];
    const toStore: ScreenshotSets = { ...result.sets, revision: stored.revision + 1, known };
    await writeJsonAtomic(path.join(workspace.root, FILE), toStore);
    return { ok: true, sets: mergeWithInputs(toStore, screenshots) };
  };
  const previous = saveQueues.get(workspace.root) ?? Promise.resolve();
  const next = previous.then(run, run);
  saveQueues.set(workspace.root, next.catch(() => undefined));
  return next;
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
