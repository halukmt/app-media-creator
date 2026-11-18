// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { linesToList, listToLines } from '../../src/web/lib/lines.js';
import {
  chooseLocale,
  isAllSelected,
  restrictSelection,
  selectAll,
  selectionForProject,
  sourceLocaleFor,
} from '../../src/web/lib/locale-selection.js';
import { fieldError, groupProjectErrors } from '../../src/web/lib/errors.js';
import { sectionFromHash, sectionHref, targetsNeeding } from '../../src/web/lib/sections.js';
import { downloadFileName, isWorseStatus, sortByStatus, summarizeChecklist } from '../../src/web/lib/export.js';
import { allLocaleIds, checklistFactory, enabledTargets } from '../factories/web.js';

describe('Section routing follows the location hash', () => {
  test('reads the section from a hash', () => {
    expect(sectionFromHash('#/screenshots')).toBe('screenshots');
    expect(sectionFromHash('#/store-texts')).toBe('store-texts');
    expect(sectionFromHash('#/video?x=1')).toBe('video');
  });

  test('falls back to the Project section for an empty or unknown hash', () => {
    expect(sectionFromHash('')).toBe('project');
    expect(sectionFromHash('#/does-not-exist')).toBe('project');
  });

  test('builds a link that reads back as the same section', () => {
    expect(sectionFromHash(sectionHref('export'))).toBe('export');
  });

  test('names only enabled targets that need a section', () => {
    expect(targetsNeeding('screenshots', enabledTargets({ google: false }))).toEqual(['apple', 'web']);
    expect(targetsNeeding('store-texts', enabledTargets())).toEqual(['apple', 'google']);
    expect(targetsNeeding('store-texts', enabledTargets({ apple: false, google: false }))).toEqual([]);
  });
});

describe('The locale selector keeps a valid selection', () => {
  const offered = allLocaleIds();

  test('selects all offered locales with "All languages"', () => {
    expect(selectAll(offered)).toEqual(offered);
    expect(isAllSelected(['de-DE'], offered)).toBe(false);
    expect(isAllSelected(offered, offered)).toBe(true);
  });

  test('toggles a locale in multi-select mode and keeps the catalogue order', () => {
    expect(chooseLocale(['tr-TR'], 'de-DE', offered, true)).toEqual(['de-DE', 'tr-TR']);
    expect(chooseLocale(['de-DE', 'tr-TR'], 'de-DE', offered, true)).toEqual(['tr-TR']);
  });

  test('keeps the last selected locale instead of an empty selection', () => {
    expect(chooseLocale(['tr-TR'], 'tr-TR', offered, true)).toEqual(['tr-TR']);
  });

  test('selects exactly one locale in single mode', () => {
    expect(chooseLocale(['de-DE'], 'tr-TR', offered, false)).toEqual(['tr-TR']);
  });

  test('ignores a locale that is not offered', () => {
    expect(chooseLocale(['de-DE'], 'pt-BR', ['de-DE', 'tr-TR'], true)).toEqual(['de-DE']);
    expect(restrictSelection(['de-DE', 'fr-FR'], ['de-DE', 'tr-TR'])).toEqual(['de-DE']);
  });

  test('limits a section selection to the project locales, or takes all of them when nothing is left', () => {
    expect(selectionForProject(['de-DE', 'fr-FR'], ['de-DE', 'tr-TR'])).toEqual(['de-DE']);
    expect(selectionForProject(['fr-FR'], ['de-DE', 'tr-TR'])).toEqual(['de-DE', 'tr-TR']);
  });
});

describe('Server validation messages are shown next to their field', () => {
  test('groups messages by the field in their path', () => {
    const grouped = groupProjectErrors([
      'name: App name is required',
      'targets.apple.devices: google.screenshot.phone is not a apple device',
      'claims.allowed.0: Too small',
    ]);
    expect(fieldError(grouped, 'name')).toBe('App name is required');
    expect(fieldError(grouped, 'targets.apple')).toBe('google.screenshot.phone is not a apple device');
    expect(fieldError(grouped, 'claims.allowed')).toBe('Too small');
    expect(grouped.other).toEqual([]);
  });

  test('keeps messages without a known field for the general alert', () => {
    const grouped = groupProjectErrors(['The request body must be JSON', 'version: Invalid input']);
    expect(grouped.other).toEqual(['The request body must be JSON', 'version: Invalid input']);
    expect(fieldError(grouped, 'name')).toBeUndefined();
  });
});

describe('The source language follows the selected languages', () => {
  test('stays while it is selected', () => {
    expect(sourceLocaleFor('tr-TR', ['de-DE', 'tr-TR'])).toBe('tr-TR');
  });

  test('moves to the first selected language when it is deselected', () => {
    expect(sourceLocaleFor('en-US', ['de-DE', 'tr-TR'])).toBe('de-DE');
  });
});

describe('The Export section summarizes the checklist', () => {
  test('counts items per status and generated files', () => {
    expect(summarizeChecklist(checklistFactory())).toEqual({ ok: 1, warning: 1, error: 1, files: 3 });
  });

  test('lists errors first, then warnings, then ok items, keeping their order', () => {
    const items = checklistFactory().targets.flatMap((target) => target.items);
    expect(sortByStatus(items).map((item) => item.status)).toEqual(['error', 'warning', 'ok']);
  });

  test('notices when the files got worse while the ZIP was built', () => {
    expect(isWorseStatus('error', 'warning')).toBe(true);
    expect(isWorseStatus('ok', 'warning')).toBe(false);
    expect(isWorseStatus(null, 'ok')).toBe(false);
    expect(isWorseStatus('unknown', 'ok')).toBe(false);
  });

  test('takes the download name from the server header', () => {
    expect(downloadFileName('attachment; filename="Demo-all-2026.zip"', 'export.zip')).toBe('Demo-all-2026.zip');
  });

  test('never uses a path from the header and falls back without one', () => {
    expect(downloadFileName('attachment; filename="../../evil.zip"', 'export.zip')).toBe('evil.zip');
    expect(downloadFileName('attachment; filename=".."', 'export.zip')).toBe('export.zip');
    expect(downloadFileName(null, 'export.zip')).toBe('export.zip');
  });
});

describe('Claims are edited one per line', () => {
  test('turns non-blank trimmed lines into a list', () => {
    expect(linesToList('  Free to try \r\n\nWorks offline\n')).toEqual(['Free to try', 'Works offline']);
  });

  test('returns an empty list for blank text', () => {
    expect(linesToList('  \n ')).toEqual([]);
  });

  test('writes a list back as lines', () => {
    expect(listToLines(['a', 'b'])).toBe('a\nb');
  });
});
