import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { isLocaleId, type LocaleId } from '../locales/index.js';
import { MAX_STORE_TEXT, checkStoreText, isStoreTextField, type StoreTextField, type StoreTextMessage } from '../specs/texts.js';
import { writeJsonAtomic, type Workspace } from './workspace.js';

/**
 * Store texts: per locale, the text of each store listing field, in `<workspace>/store-texts.json`. Texts are stored as
 * typed (also over a store limit, so a draft is never lost); the checks and the export trim them.
 */

const FILE = 'store-texts.json';

/**
 * `store-texts.json` exists but cannot be read as a store texts document (not JSON, wrong shape, newer version).
 * Nothing may save over it: the user's texts would be lost.
 */
export class StoreTextsFileError extends Error {
  constructor(readonly problems: string[]) {
    super(`store-texts.json in the workspace is invalid: ${problems.join('; ')}`);
  }
}

export type LocaleStoreTexts = Partial<Record<StoreTextField, string>>;

export interface StoreTexts {
  version: 1;
  /** Counts the stored versions; a save based on an older revision is rejected (as for the screenshot sets). */
  revision: number;
  texts: Partial<Record<LocaleId, LocaleStoreTexts>>;
}

export function defaultStoreTexts(): StoreTexts {
  return { version: 1, revision: 0, texts: {} };
}

const documentSchema = z.object({
  version: z.literal(1).optional(),
  revision: z.number().int().min(0).optional(),
  texts: z.record(z.string(), z.record(z.string(), z.unknown())),
});

export type StoreTextsValidation = { ok: true; storeTexts: StoreTexts } | { ok: false; errors: string[]; conflict?: true; current?: StoreTexts };

/**
 * Validates a store texts document: known locales and fields, texts up to 10 000 characters. Line ends become `\n`;
 * empty texts are dropped. `lenient` (for the stored file) drops unknown locales, unknown fields and broken texts
 * (not text, too long) one by one instead of rejecting the document, so one bad entry never hides the others.
 */
export function validateStoreTexts(input: unknown, lenient = false): StoreTextsValidation {
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'store texts'}: ${issue.message}`) };
  }
  const errors: string[] = [];
  const texts: StoreTexts['texts'] = {};
  for (const [locale, fields] of Object.entries(parsed.data.texts)) {
    if (!isLocaleId(locale)) {
      if (!lenient) errors.push(`texts.${locale}: not a supported locale`);
      continue;
    }
    const kept: LocaleStoreTexts = {};
    for (const [field, text] of Object.entries(fields)) {
      if (!isStoreTextField(field)) {
        if (!lenient) errors.push(`texts.${locale}.${field}: not a store text field`);
        continue;
      }
      if (typeof text !== 'string' || text.length > MAX_STORE_TEXT) {
        if (!lenient) errors.push(`texts.${locale}.${field}: ${typeof text !== 'string' ? 'must be text' : `at most ${MAX_STORE_TEXT} characters`}`);
        continue;
      }
      const normalized = text.replace(/\r\n?/g, '\n');
      if (normalized.trim()) kept[field] = normalized;
    }
    if (Object.keys(kept).length > 0) texts[locale] = kept;
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, storeTexts: { version: 1, revision: parsed.data.revision ?? 0, texts } };
}

/**
 * The stored texts, or an empty document with revision 0 when there is no file. Throws StoreTextsFileError when the
 * file is broken as a whole, so no save replaces it with an empty document.
 */
export async function readStoreTexts(workspace: Workspace): Promise<StoreTexts> {
  const file = path.join(workspace.root, FILE);
  if (!existsSync(file)) return defaultStoreTexts();
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    throw new StoreTextsFileError(['not valid JSON']);
  }
  const result = validateStoreTexts(raw, true);
  if (!result.ok) throw new StoreTextsFileError(result.errors);
  return result.storeTexts;
}

// Saves of one workspace run one after another, so two saves based on the same revision cannot both pass the check.
const saveQueues = new Map<string, Promise<unknown>>();

/**
 * Validates and stores the texts. When the input names a `revision`, it must be the stored one; otherwise nothing is
 * written and the result is a conflict with the current document. Each save stores the next revision. (Internal
 * callers pass the revision they read; the HTTP route requires one.)
 */
export function saveStoreTexts(workspace: Workspace, input: unknown): Promise<StoreTextsValidation> {
  const run = async (): Promise<StoreTextsValidation> => {
    const result = validateStoreTexts(input);
    if (!result.ok) return result;
    const stored = await readStoreTexts(workspace);
    const based = (input as { revision?: unknown }).revision;
    if (typeof based === 'number' && based !== stored.revision) {
      return {
        ok: false,
        conflict: true,
        current: stored,
        errors: [`The store texts were changed elsewhere (revision ${stored.revision}); this save is based on revision ${based}`],
      };
    }
    const toStore: StoreTexts = { ...result.storeTexts, revision: stored.revision + 1 };
    await writeJsonAtomic(path.join(workspace.root, FILE), toStore);
    return { ok: true, storeTexts: toStore };
  };
  const previous = saveQueues.get(workspace.root) ?? Promise.resolve();
  const next = previous.then(run, run);
  saveQueues.set(workspace.root, next.catch(() => undefined));
  return next;
}

export type StoreTextChecks = Partial<Record<LocaleId, Partial<Record<StoreTextField, StoreTextMessage[]>>>>;

/** The check messages of every stored text that has any, per locale and field (missing fields are not reported). */
export function storeTextChecks(storeTexts: StoreTexts): StoreTextChecks {
  const checks: StoreTextChecks = {};
  for (const [locale, fields] of Object.entries(storeTexts.texts) as [LocaleId, LocaleStoreTexts][]) {
    for (const [field, text] of Object.entries(fields) as [StoreTextField, string][]) {
      const messages = checkStoreText(field, text, fields, locale);
      if (messages.length > 0) (checks[locale] ??= {})[field] = messages;
    }
  }
  return checks;
}
