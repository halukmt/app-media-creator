// conventions: RULE-TESTING-3301
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { createExport, exportChecklist } from '../../src/core/export/index.js';
import { STORE_TEXT_FIELDS, STORE_TEXT_SPECS, checkStoreListing, checkStoreText, storeTextLength, storeTextSpecs } from '../../src/core/specs/index.js';
import { StoreTextsFileError, readStoreTexts, saveProject, saveStoreTexts, storeTextChecks } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { storeListingTexts, storeTextsDocument } from '../factories/store-texts.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

describe('The store text catalogue lists every listing field once', () => {
  test('has each field once, with a source, in paste order per store', () => {
    expect(STORE_TEXT_SPECS.map((spec) => spec.field)).toEqual([...STORE_TEXT_FIELDS]);
    for (const spec of STORE_TEXT_SPECS) expect(spec.sourceUrl).toMatch(/^https:\/\/(developer\.apple\.com|support\.google\.com)\//);
    expect(storeTextSpecs('apple').map((spec) => [spec.order, spec.fileName, spec.max])).toEqual([
      [1, 'name', 30],
      [2, 'subtitle', 30],
      [3, 'promotional-text', 170],
      [4, 'description', 4000],
      [5, 'keywords', 100],
      [6, 'whats-new', 4000],
    ]);
    expect(storeTextSpecs('google').map((spec) => [spec.fileName, spec.max])).toEqual([
      ['title', 30],
      ['short-description', 80],
      ['full-description', 4000],
    ]);
  });

  test('counts Apple keywords in bytes, so Turkish letters count twice', () => {
    const keywords = 'ğ'.repeat(51);
    expect(storeTextLength({ unit: 'characters' }, keywords)).toBe(51);
    expect(storeTextLength({ unit: 'bytes' }, keywords)).toBe(102);
    expect(checkStoreText('apple-keywords', keywords, {}, 'tr-TR')).toContainEqual({ level: 'error', text: 'Keywords has 102 bytes; the store allows 100' });
  });
});

describe('Store texts are checked against the store rules', () => {
  test('accepts a complete German and Turkish listing without messages', () => {
    const texts = storeListingTexts();
    for (const locale of ['de-DE', 'tr-TR'] as const) {
      for (const field of Object.keys(texts[locale]!) as (keyof (typeof texts)['de-DE'])[]) {
        expect(checkStoreText(field, texts[locale]![field]!, texts[locale], locale)).toEqual([]);
      }
    }
  });

  test('reports a subtitle over the limit and a multi-line name as errors, counting after trimming', () => {
    expect(checkStoreText('apple-subtitle', `  ${'a'.repeat(30)}  `)).toEqual([]);
    expect(checkStoreText('apple-subtitle', 'a'.repeat(31))).toEqual([{ level: 'error', text: 'Subtitle has 31 characters; the store allows 30' }]);
    expect(checkStoreText('apple-name', 'Team\nfinder').map((m) => m.text)).toContain('App name must be one line');
  });

  test('warns about keyword format, repeated words and the Play title style', () => {
    const keywords = checkStoreText('apple-keywords', 'teams, fußball,fußball,,finder', { 'apple-name': 'Teamfinder', 'apple-subtitle': 'Faire Teams' }, 'de-DE').map((m) => m.text);
    expect(keywords).toEqual([
      'Keywords: spaces after commas use up bytes; separate with commas only',
      'Keywords: listed twice: fußball',
      'Keywords: remove the empty entry between two commas',
      'Keywords: teams already in the name or subtitle; the store counts them there',
    ]);
    expect(checkStoreText('google-title', 'TEAMFINDER ⚽ #1').map((m) => m.level)).toEqual(['warning', 'warning', 'warning']);
  });

  test('reports missing required fields of a listing', () => {
    const apple = checkStoreListing('apple', { 'apple-name': 'Teamfinder' }, 'de-DE');
    expect(apple.flatMap((entry) => entry.messages.map((m) => m.text))).toEqual(['Description is required', 'Keywords is required']);
  });
});

describe('The store texts document is saved with a revision', () => {
  test('stores texts, normalizes line ends and drops empty texts', async () => {
    const workspace = await workspaceFactory();
    const saved = await saveStoreTexts(workspace, storeTextsDocument({ 'de-DE': { 'apple-name': 'Teamfinder', 'apple-description': 'Zeile 1\r\nZeile 2', 'apple-subtitle': '  ' } }));
    expect(saved.ok).toBe(true);
    const stored = await readStoreTexts(workspace);
    expect(stored.revision).toBe(1);
    expect(stored.texts).toEqual({ 'de-DE': { 'apple-name': 'Teamfinder', 'apple-description': 'Zeile 1\nZeile 2' } });
  });

  test('rejects a stale revision, an unknown field and an unknown locale', async () => {
    const workspace = await workspaceFactory();
    expect((await saveStoreTexts(workspace, storeTextsDocument(undefined, 0))).ok).toBe(true);
    const stale = await saveStoreTexts(workspace, storeTextsDocument(undefined, 0));
    expect(stale).toMatchObject({ ok: false, conflict: true, current: { revision: 1 } });
    const unknown = await saveStoreTexts(workspace, storeTextsDocument({ 'de-DE': { 'apple-slogan': 'x' } as never, 'xx-XX': {} }, 1));
    expect(unknown).toMatchObject({ ok: false, errors: ['texts.de-DE.apple-slogan: not a store text field', 'texts.xx-XX: not a supported locale'] });
  });

  test('drops a broken entry of the stored file but keeps the others', async () => {
    const workspace = await workspaceFactory();
    const file = path.join(workspace.root, 'store-texts.json');
    writeFileSync(file, JSON.stringify({ version: 1, revision: 4, texts: { 'de-DE': { 'apple-name': 'Teamfinder', 'apple-subtitle': 42, 'apple-description': 'x'.repeat(10_001) } } }));
    expect(await readStoreTexts(workspace)).toEqual({ version: 1, revision: 4, texts: { 'de-DE': { 'apple-name': 'Teamfinder' } } });
  });

  test('never saves over a file that is broken as a whole, and the export reports it', async () => {
    const workspace = await workspaceFactory();
    const file = path.join(workspace.root, 'store-texts.json');
    writeFileSync(file, '{ not json');
    await expect(readStoreTexts(workspace)).rejects.toBeInstanceOf(StoreTextsFileError);
    await expect(saveStoreTexts(workspace, storeTextsDocument(undefined, 0))).rejects.toBeInstanceOf(StoreTextsFileError);
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    expect((await app.request('http://localhost:4790/api/store-texts')).status).toBe(500);
    const checklist = await exportChecklist(workspace);
    expect(checklist.status).toBe('error');
    expect(checklist.problems).toEqual(['store-texts.json in the workspace is invalid: not valid JSON; the store texts are not exported']);
  });

  test('gives check messages only for texts that have any', () => {
    const checks = storeTextChecks({ version: 1, revision: 1, texts: { 'tr-TR': { 'apple-subtitle': 'a'.repeat(31), 'apple-name': 'Teamfinder' } } });
    expect(checks).toEqual({ 'tr-TR': { 'apple-subtitle': [{ level: 'error', text: 'Subtitle has 31 characters; the store allows 30' }] } });
  });
});

describe('The export holds the store texts in paste order with store locale codes', () => {
  async function exportWorkspace() {
    const workspace = await workspaceFactory();
    const project = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'it-IT', 'tr-TR'] }));
    if (!project.ok) throw new Error(project.errors.join('; '));
    const texts = { ...storeListingTexts(), 'it-IT': { 'apple-name': 'Teamfinder', 'apple-description': 'Squadre giuste in pochi secondi.', 'google-title': 'Teamfinder' } };
    expect((await saveStoreTexts(workspace, storeTextsDocument(texts))).ok).toBe(true);
    return workspace;
  }

  test('writes apple/store-texts/it/NN-field.txt and google/store-texts/it-IT/NN-field.txt with the trimmed text', async () => {
    const workspace = await exportWorkspace();
    const result = await createExport(workspace, { locales: ['it-IT', 'tr-TR'] });
    const files = unzipSync(readFileSync(result.file));
    const texts = Object.keys(files).filter((name) => name.includes('/store-texts/')).sort();
    expect(texts).toEqual([
      'apple/store-texts/it/01-name.txt',
      'apple/store-texts/it/04-description.txt',
      'apple/store-texts/tr/01-name.txt',
      'apple/store-texts/tr/04-description.txt',
      'apple/store-texts/tr/05-keywords.txt',
      'google/store-texts/it-IT/01-title.txt',
    ]);
    expect(strFromU8(files['apple/store-texts/tr/05-keywords.txt']!)).toBe('futbol,takım,kura,halı saha');
  });

  test('checks every selected locale of a store with texts, and leaves out a store that is turned off', async () => {
    const workspace = await exportWorkspace();
    const checklist = await exportChecklist(workspace, { locales: ['de-DE', 'it-IT'] });
    const items = checklist.targets.flatMap((target) => target.items.filter((item) => item.specId.endsWith('.store-texts')));
    expect(items.map((item) => [item.specId, item.locale, item.status])).toEqual([
      ['apple.store-texts', 'de-DE', 'ok'],
      ['apple.store-texts', 'it-IT', 'error'],
      ['google.store-texts', 'de-DE', 'ok'],
      ['google.store-texts', 'it-IT', 'error'],
    ]);
    expect(items[1]!.messages.map((m) => m.text)).toEqual(['Keywords is required']);
    await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'it-IT', 'tr-TR'], targets: { ...projectInputFactory().targets as object, google: { enabled: false, devices: [] } } }));
    const result = await createExport(workspace, { locales: 'de-DE' });
    expect(result.entries.some((entry) => entry.startsWith('google/store-texts/'))).toBe(false);
  });
});

describe('The store texts API saves with a revision and returns the checks', () => {
  test('saves, answers a stale save with 409 and the current document, and requires a revision', async () => {
    const workspace = await workspaceFactory();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const put = (body: unknown) => app.request('http://localhost:4790/api/store-texts', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const saved = await put(storeTextsDocument({ 'de-DE': { 'apple-subtitle': 'a'.repeat(31) } }, 0));
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ revision: 1, checks: { 'de-DE': { 'apple-subtitle': [{ level: 'error' }] } } });
    const stale = await put(storeTextsDocument({}, 0));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ current: { revision: 1, texts: { 'de-DE': { 'apple-subtitle': 'a'.repeat(31) } } } });
    expect((await put({ texts: {} })).status).toBe(400);
    expect(await (await app.request('http://localhost:4790/api/store-texts')).json()).toMatchObject({ revision: 1 });
  });
});
