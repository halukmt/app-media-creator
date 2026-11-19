// conventions: RULE-TESTING-3301
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { exportChecklist, readManifest } from '../../src/core/export/index.js';
import { generateScreenshotCards } from '../../src/core/generators/screenshot-cards.js';
import {
  MAX_SET_SIZE,
  defaultScreenshotSets,
  effectiveSet,
  listInputs,
  readProject,
  readScreenshotSets,
  saveInput,
  saveProject,
  saveScreenshotSets,
  type StoredInput,
  type Workspace,
} from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot } from '../factories/screenshots.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

/** A small project: German source, German and Turkish, one Apple and one Play device. */
async function smallProject(devices: { apple?: string[]; google?: string[] } = {}): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const base = projectInputFactory();
  const result = await saveProject(workspace, {
    ...base,
    sourceLocale: 'de-DE',
    locales: ['de-DE', 'tr-TR'],
    targets: {
      apple: { enabled: true, devices: devices.apple ?? ['apple.screenshot.iphone-6.3'] },
      google: { enabled: true, devices: devices.google ?? ['google.screenshot.phone'] },
      web: { enabled: true, devices: [] },
    },
  });
  if (!result.ok) throw new Error(result.errors.join('; '));
  return workspace;
}

async function upload(workspace: Workspace, locale: string, name: string): Promise<StoredInput> {
  return saveInput(workspace, 'de-DE', { kind: 'screenshot', locale, originalName: name, bytes: await appScreenshot(118, 256) });
}

describe('Screenshot sets follow the uploads', () => {
  test('appends new uploads in upload order and drops deleted ones', async () => {
    const workspace = await smallProject();
    const first = await upload(workspace, 'de-DE', 'start.png');
    const second = await upload(workspace, 'de-DE', 'teams.png');
    expect((await readScreenshotSets(workspace)).sets['de-DE']?.map((e) => e.input)).toEqual([first.path, second.path]);
  });

  test('keeps headlines attached to their screenshot when the order changes', async () => {
    const workspace = await smallProject();
    const a = await upload(workspace, 'de-DE', 'a.png');
    const b = await upload(workspace, 'de-DE', 'b.png');
    const sets = await readScreenshotSets(workspace);
    sets.sets['de-DE'] = [
      { input: a.path, headline: 'Erste', subline: '' },
      { input: b.path, headline: 'Zweite', subline: 'Mehr' },
    ];
    await saveScreenshotSets(workspace, sets);
    sets.sets['de-DE'] = [...sets.sets['de-DE'].reverse()];
    const saved = await saveScreenshotSets(workspace, sets);
    expect(saved.ok).toBe(true);
    expect((await readScreenshotSets(workspace)).sets['de-DE']).toEqual([
      { input: b.path, headline: 'Zweite', subline: 'Mehr' },
      { input: a.path, headline: 'Erste', subline: '' },
    ]);
  });

  test('rejects unknown screenshots, duplicates, too many entries and unsupported locales', async () => {
    const workspace = await smallProject();
    const a = await upload(workspace, 'de-DE', 'a.png');
    const style = defaultScreenshotSets().style;
    const entry = { input: a.path, headline: '', subline: '' };
    const result = await saveScreenshotSets(workspace, {
      style,
      sets: { 'de-DE': [entry, entry, { ...entry, input: 'inputs/screenshots/de-DE/missing.png' }], 'pt-BR': [entry] },
    });
    expect(result.ok ? [] : result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('is listed twice'),
        expect.stringContaining('missing.png is not an uploaded screenshot'),
        'sets.pt-BR: not a supported locale',
      ]),
    );
    const tooMany = await saveScreenshotSets(workspace, { style, sets: { 'de-DE': Array.from({ length: MAX_SET_SIZE + 1 }, () => entry) } });
    expect(tooMany.ok ? [] : tooMany.errors).toEqual([`sets.de-DE: at most ${MAX_SET_SIZE} screenshots per language`]);
  });

  test('keeps the other texts and the style when one screenshot is deleted', async () => {
    const workspace = await smallProject();
    const a = await upload(workspace, 'de-DE', 'a.png');
    const b = await upload(workspace, 'de-DE', 'b.png');
    const sets = await readScreenshotSets(workspace);
    sets.style = { layout: 'text-bottom', background: { kind: 'solid', color: '#34c759' } };
    sets.sets['de-DE'] = [
      { input: a.path, headline: 'Erste', subline: '' },
      { input: b.path, headline: 'Zweite', subline: '' },
    ];
    await saveScreenshotSets(workspace, sets);
    rmSync(path.join(workspace.root, a.path));
    const after = await readScreenshotSets(workspace);
    expect(after.style.layout).toBe('text-bottom');
    expect(after.sets['de-DE']).toEqual([{ input: b.path, headline: 'Zweite', subline: '' }]);
  });

  test('leaves a screenshot out once the user removed it from the set, but appends new uploads', async () => {
    const workspace = await smallProject();
    const a = await upload(workspace, 'de-DE', 'a.png');
    await upload(workspace, 'de-DE', 'b.png');
    const sets = await readScreenshotSets(workspace);
    sets.sets['de-DE'] = [{ input: a.path, headline: '', subline: '' }];
    await saveScreenshotSets(workspace, sets);
    const c = await upload(workspace, 'de-DE', 'c.png');
    expect((await readScreenshotSets(workspace)).sets['de-DE']?.map((e) => e.input)).toEqual([a.path, c.path]);
  });

  test('rejects an unknown layout and a colour that is not #rrggbb', async () => {
    const workspace = await smallProject();
    const result = await saveScreenshotSets(workspace, { style: { layout: 'sideways', background: { kind: 'solid', color: 'red' } }, sets: {} });
    expect(result.ok ? [] : result.errors.map((e) => e.split(':')[0])).toEqual(['style.layout', 'style.background']);
  });
});

describe('Projects saved with devices outside the matrix stay readable', () => {
  test('drops devices an earlier version offered when reading project.json', async () => {
    const workspace = await smallProject();
    const stored = JSON.parse(readFileSync(workspace.projectFile, 'utf8')) as { targets: { apple: { devices: string[] } } };
    stored.targets.apple.devices.push('apple.screenshot.apple-tv');
    writeFileSync(workspace.projectFile, JSON.stringify(stored));
    expect((await readProject(workspace)).targets.apple.devices).toEqual(['apple.screenshot.iphone-6.3']);
  });

  test('still rejects such a device when it is saved', async () => {
    const workspace = await smallProject();
    const project = await readProject(workspace);
    const result = await saveProject(workspace, { ...project, targets: { ...project.targets, apple: { enabled: true, devices: ['apple.screenshot.apple-tv'] } } });
    expect(result.ok).toBe(false);
  });
});

describe('Locales without own screenshots fall back to the source language', () => {
  test('uses the source set and marks every entry as fallback input', async () => {
    const workspace = await smallProject();
    await upload(workspace, 'de-DE', 'start.png');
    const sets = await readScreenshotSets(workspace);
    const inputs = await listInputs(workspace);
    expect(effectiveSet(sets, 'tr-TR', 'de-DE', inputs).map((e) => e.fallbackInput)).toEqual([true]);
    expect(effectiveSet(sets, 'de-DE', 'de-DE', inputs).map((e) => e.fallbackInput)).toEqual([false]);
  });

  test('uses the own set of a locale without fallback', async () => {
    const workspace = await smallProject();
    await upload(workspace, 'de-DE', 'start.png');
    await upload(workspace, 'tr-TR', 'baslangic.png');
    const sets = await readScreenshotSets(workspace);
    const entries = effectiveSet(sets, 'tr-TR', 'de-DE', await listInputs(workspace));
    expect(entries.map((e) => [e.input.includes('/tr-TR/'), e.fallbackInput])).toEqual([[true, false]]);
  });
});

describe('generateScreenshotCards renders the device matrix per locale', () => {
  test('renders every device and locale, marks fallback locales, and reports them in the checklist', async () => {
    const workspace = await smallProject();
    const start = await upload(workspace, 'de-DE', 'start.png');
    const sets = await readScreenshotSets(workspace);
    sets.sets['de-DE'] = [{ input: start.path, headline: 'Faire Teams', subline: '' }];
    await saveScreenshotSets(workspace, sets);

    const result = await generateScreenshotCards(workspace);
    expect(result.entries.map((e) => [e.path, e.fallbackInput]).sort()).toEqual([
      ['apple/de-DE/iphone-6.3/01-start.png', false],
      ['apple/tr-TR/iphone-6.3/01-start.png', true],
      ['google/de-DE/phone/01-start.png', false],
      ['google/tr-TR/phone/01-start.png', true],
    ]);
    const checklist = await exportChecklist(workspace, { locales: ['tr-TR'] });
    const iphone = checklist.targets.flatMap((t) => t.items).find((i) => i.specId === 'apple.screenshot.iphone-6.3' && i.locale === 'tr-TR');
    expect(iphone?.messages.some((m) => m.text.includes('made from the de-DE input'))).toBe(true);
    // One screenshot is below the Play phone minimum of 2.
    expect(result.warnings.filter((w) => w.code === 'too-few-screenshots').map((w) => w.path).sort()).toEqual(['google/de-DE/phone', 'google/tr-TR/phone']);
  }, 60_000);

  test('removes the cards of a device that is no longer picked', async () => {
    const workspace = await smallProject({ google: [] });
    await upload(workspace, 'de-DE', 'start.png');
    await generateScreenshotCards(workspace, { locales: 'de-DE' });
    const result = await saveProject(workspace, { ...(await readProject(workspace)), targets: { ...(await readProject(workspace)).targets, apple: { enabled: true, devices: ['apple.screenshot.iphone-6.9'] } } });
    expect(result.ok).toBe(true);
    await generateScreenshotCards(workspace, { locales: 'de-DE' });
    expect((await readManifest(workspace)).entries.map((e) => e.path)).toEqual(['apple/de-DE/iphone-6.9/01-start.png']);
  }, 60_000);

  test('generates one locale only when asked', async () => {
    const workspace = await smallProject({ google: [] });
    await upload(workspace, 'de-DE', 'start.png');
    const result = await generateScreenshotCards(workspace, { locales: 'tr-TR' });
    expect(result.entries.map((e) => e.path)).toEqual(['apple/tr-TR/iphone-6.3/01-start.png']);
  }, 60_000);

  test('gives Google Play at most 8 screenshots and the App Store up to 10', async () => {
    const workspace = await smallProject({ apple: [] });
    for (let i = 1; i <= 9; i += 1) await upload(workspace, 'de-DE', `shot-${i}.png`);
    const result = await generateScreenshotCards(workspace, { locales: 'de-DE' });
    expect(result.entries).toHaveLength(8);
    expect((await readManifest(workspace)).entries.every((e) => e.specId === 'google.screenshot.phone')).toBe(true);
  }, 60_000);

  test('asks for screenshots and for a device when there is nothing to render', async () => {
    const workspace = await smallProject();
    await expect(generateScreenshotCards(workspace)).rejects.toThrow('Upload screenshots for de-DE first');
    const noDevices = await smallProject({ apple: [], google: [] });
    await expect(generateScreenshotCards(noDevices)).rejects.toThrow(/Pick at least one/);
  });
});

describe('The screenshots API reads, saves and generates sets', () => {
  const appFor = (workspace: Workspace) => createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
  const json = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

  test('returns the merged sets and stores a valid change', async () => {
    const workspace = await smallProject();
    const start = await upload(workspace, 'de-DE', 'start.png');
    const app = appFor(workspace);
    const sets = (await (await app.request('/api/screenshots')).json()) as ReturnType<typeof defaultScreenshotSets>;
    expect(sets.sets['de-DE']?.[0]?.input).toBe(start.path);
    sets.sets['de-DE'] = [{ input: start.path, headline: 'Hallo', subline: '' }];
    const response = await app.request('/api/screenshots', json(sets));
    expect(response.status).toBe(200);
  });

  test('rejects invalid sets with 400 and the field errors', async () => {
    const app = appFor(await smallProject());
    const response = await app.request('/api/screenshots', json({ style: defaultScreenshotSets().style, sets: { 'de-DE': [{ input: '../../x', headline: '', subline: '' }] } }));
    expect(response.status).toBe(400);
    expect(((await response.json()) as { errors: string[] }).errors[0]).toContain('is not an uploaded screenshot');
  });

  test('answers the generate request with 400 when nothing is uploaded', async () => {
    const response = await appFor(await smallProject()).request('/api/generate/screenshot-cards', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(400);
  });
});
