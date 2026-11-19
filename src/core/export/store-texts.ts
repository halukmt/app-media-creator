import { getLocale, type LocaleId } from '../locales/index.js';
import { checkStoreListing, storeTextSpecs, type TextTarget } from '../specs/texts.js';
import type { ProjectSettings } from '../workspace/project.js';
import type { StoreTexts } from '../workspace/store-texts.js';
import type { ChecklistItem, CheckMessage, CheckStatus } from './checklist.js';

/** One store text file of the export: its path in the ZIP and the trimmed text. */
export interface StoreTextFile {
  target: TextTarget;
  locale: LocaleId;
  path: string;
  text: string;
}

const TEXT_TARGETS: readonly TextTarget[] = ['apple', 'google'];

/** Folder of a locale in a store's text export: the store's own locale code (`it`, `tr` for App Store Connect). */
function storeCode(target: TextTarget, locale: LocaleId): string {
  const entry = getLocale(locale);
  return target === 'apple' ? entry.appStoreConnect : entry.googlePlay;
}

/**
 * The non-empty store texts of the selected locales for every enabled store, as
 * `<target>/store-texts/<store code>/NN-<field>.txt` in the paste order of the store's form.
 */
export function storeTextFiles(project: ProjectSettings, storeTexts: StoreTexts, locales: readonly LocaleId[], only?: TextTarget): StoreTextFile[] {
  const files: StoreTextFile[] = [];
  for (const target of TEXT_TARGETS) {
    if (only !== undefined && target !== only) continue;
    if (!project.targets[target].enabled) continue;
    for (const locale of locales) {
      for (const spec of storeTextSpecs(target)) {
        const text = storeTexts.texts[locale]?.[spec.field]?.trim();
        if (!text) continue;
        const nn = String(spec.order).padStart(2, '0');
        files.push({ target, locale, path: `${target}/store-texts/${storeCode(target, locale)}/${nn}-${spec.fileName}.txt`, text });
      }
    }
  }
  return files;
}

/** True when any locale of the project has a text for this store: from then on the store texts are checked. */
function hasTexts(storeTexts: StoreTexts, target: TextTarget): boolean {
  const fields = new Set(storeTextSpecs(target).map((spec) => spec.field));
  return Object.values(storeTexts.texts).some((entry) => Object.entries(entry ?? {}).some(([field, text]) => fields.has(field as never) && text.trim() !== ''));
}

/**
 * Checklist items for the store texts: once a store has texts, one item per selected locale, with an error for every
 * missing required field or text over its limit and the advisory warnings.
 */
export function storeTextChecklistItems(project: ProjectSettings, target: TextTarget, storeTexts: StoreTexts, locales: readonly LocaleId[]): ChecklistItem[] {
  if (!hasTexts(storeTexts, target)) return [];
  const files = storeTextFiles(project, storeTexts, locales, target);
  return locales.map((locale) => {
    const messages: CheckMessage[] = checkStoreListing(target, storeTexts.texts[locale] ?? {}, locale).flatMap((entry) => entry.messages);
    const status: CheckStatus = messages.some((m) => m.level === 'error') ? 'error' : messages.length > 0 ? 'warning' : 'ok';
    return {
      specId: `${target}.store-texts`,
      name: 'Store texts',
      required: true,
      locale,
      status,
      messages,
      files: files.filter((file) => file.locale === locale).map((file) => file.path),
    };
  });
}
