/**
 * Media locales: the languages the tool generates localized assets for.
 * The order of LOCALES is the catalogue order used for every list and export.
 */

export type LocaleId = 'de-DE' | 'en-US' | 'es-ES' | 'it-IT' | 'fr-FR' | 'tr-TR';

export interface Locale {
  id: LocaleId;
  /** English display name, used in the UI. */
  name: string;
  /** Name in the language itself. */
  nativeName: string;
  /** Locale code used by App Store Connect (metadata and screenshot sets). */
  appStoreConnect: string;
  /** Locale code used by the Google Play Console. */
  googlePlay: string;
}

export const LOCALES: readonly Locale[] = Object.freeze([
  { id: 'de-DE', name: 'German', nativeName: 'Deutsch', appStoreConnect: 'de-DE', googlePlay: 'de-DE' },
  { id: 'en-US', name: 'English (US)', nativeName: 'English (US)', appStoreConnect: 'en-US', googlePlay: 'en-US' },
  { id: 'es-ES', name: 'Spanish', nativeName: 'Español', appStoreConnect: 'es-ES', googlePlay: 'es-ES' },
  { id: 'it-IT', name: 'Italian', nativeName: 'Italiano', appStoreConnect: 'it', googlePlay: 'it-IT' },
  { id: 'fr-FR', name: 'French', nativeName: 'Français', appStoreConnect: 'fr-FR', googlePlay: 'fr-FR' },
  { id: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', appStoreConnect: 'tr', googlePlay: 'tr-TR' },
] satisfies Locale[]);

export const LOCALE_IDS: readonly LocaleId[] = LOCALES.map((locale) => locale.id);

/**
 * A locale selection as the UI, CLI and project settings express it: "all", one locale id or a list of ids.
 * Kept as plain strings because selections come from user input; resolveLocales validates them.
 * "all" may also appear inside a list.
 */
export type LocaleSelection = string | readonly string[];

export function isLocaleId(value: string): value is LocaleId {
  return (LOCALE_IDS as readonly string[]).includes(value);
}

/** Returns the locale with the given id. Throws for an unsupported id. */
export function getLocale(id: string): Locale {
  const locale = LOCALES.find((candidate) => candidate.id === id);
  if (!locale) throw new Error(`${id} is not a supported locale (supported: ${LOCALE_IDS.join(', ')})`);
  return locale;
}

/**
 * Resolves one locale, several locales or "all" into a list without duplicates, in catalogue order.
 * Throws when a locale is not supported or the selection is empty.
 */
export function resolveLocales(selection: LocaleSelection): LocaleId[] {
  const requested = typeof selection === 'string' ? [selection] : [...selection];
  if (requested.includes('all')) return [...LOCALE_IDS];
  if (requested.length === 0) throw new Error('Select at least one locale');
  const unsupported = requested.filter((id) => !isLocaleId(id));
  if (unsupported.length > 0) {
    throw new Error(`${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not a supported locale`);
  }
  return LOCALE_IDS.filter((id) => requested.includes(id));
}
