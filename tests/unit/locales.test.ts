// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { LOCALES, getLocale, resolveLocales, selectProjectLocales } from '../../src/core/locales/index.js';

describe('The locale catalogue lists the six media locales with their store codes', () => {
  test('contains the six locales in catalogue order', () => {
    expect(LOCALES.map((l) => l.id)).toEqual(['de-DE', 'en-US', 'es-ES', 'it-IT', 'fr-FR', 'tr-TR']);
  });

  test('uses it and tr as App Store Connect codes for Italian and Turkish', () => {
    expect(getLocale('it-IT').appStoreConnect).toBe('it');
    expect(getLocale('tr-TR').appStoreConnect).toBe('tr');
    expect(getLocale('de-DE').appStoreConnect).toBe('de-DE');
  });

  test('uses the full locale ids as Google Play codes', () => {
    expect(LOCALES.map((l) => l.googlePlay)).toEqual(['de-DE', 'en-US', 'es-ES', 'it-IT', 'fr-FR', 'tr-TR']);
  });

  test('has native names such as Türkçe', () => {
    expect(getLocale('tr-TR').nativeName).toBe('Türkçe');
    expect(getLocale('fr-FR').nativeName).toBe('Français');
  });

  test('rejects an unsupported locale id', () => {
    expect(() => getLocale('pt-BR')).toThrow('pt-BR is not a supported locale');
  });
});

describe('resolveLocales turns one, several or all locales into an ordered list', () => {
  test('returns all six locales for "all"', () => {
    expect(resolveLocales('all')).toHaveLength(6);
  });

  test('treats "all" inside a list as all locales', () => {
    expect(resolveLocales(['all'])).toHaveLength(6);
  });

  test('rejects an unsupported locale next to "all" and names it (#30)', () => {
    expect(() => resolveLocales(['all', 'pt-BR'])).toThrow(/pt-BR is not a supported locale/);
  });

  test('returns a single locale', () => {
    expect(resolveLocales('es-ES')).toEqual(['es-ES']);
  });

  test('removes duplicates and keeps catalogue order', () => {
    expect(resolveLocales(['tr-TR', 'de-DE', 'tr-TR'])).toEqual(['de-DE', 'tr-TR']);
  });

  test('rejects an unsupported locale with its name', () => {
    expect(() => resolveLocales(['de-DE', 'pt-BR'])).toThrow('pt-BR is not a supported locale');
  });

  test('rejects an empty selection', () => {
    expect(() => resolveLocales([])).toThrow('Select at least one locale');
  });
});

describe('selectProjectLocales keeps a selection inside the project\'s locales', () => {
  const project = ['tr-TR', 'de-DE'] as const;

  test('reads no selection and "all" as the project\'s locales in catalogue order', () => {
    expect(selectProjectLocales(project, undefined)).toEqual(['de-DE', 'tr-TR']);
    expect(selectProjectLocales(project, 'all')).toEqual(['de-DE', 'tr-TR']);
    expect(selectProjectLocales(project, ['all', 'de-DE'])).toEqual(['de-DE', 'tr-TR']);
    expect(selectProjectLocales(project, ['tr-TR'])).toEqual(['tr-TR']);
  });

  test('rejects locales outside the project, unsupported locales and an empty list', () => {
    expect(() => selectProjectLocales(project, 'fr-FR')).toThrow('fr-FR is not a locale of this project');
    expect(() => selectProjectLocales(project, ['fr-FR', 'es-ES', 'de-DE'])).toThrow('es-ES, fr-FR are not locales of this project');
    expect(() => selectProjectLocales(project, ['all', 'pt-BR'])).toThrow('pt-BR is not a supported locale');
    expect(() => selectProjectLocales(project, [])).toThrow('Select at least one locale');
    expect(() => selectProjectLocales(project, 5 as never)).toThrow('locales must be "all", a locale id or a list of locale ids');
    expect(() => selectProjectLocales(project, [null] as never)).toThrow('locales must be');
  });
});
