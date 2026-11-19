// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { buildChecklist, checklistMarkdown, type Manifest } from '../../src/core/export/index.js';
import { defaultProject, type ProjectSettings } from '../../src/core/workspace/index.js';
import { measureFactory, outputEntryFactory, screenshotEntries } from '../factories/export.js';
import { imagePropsFactory, videoPropsFactory } from '../factories/media.js';
import { FfmpegMissingError } from '../../src/core/video/index.js';

const valid63 = imagePropsFactory({ width: 1206, height: 2622 });

interface RunOptions {
  project?: ProjectSettings;
  byPath?: Record<string, object>;
  missing?: string[];
  foreign?: string[];
  problems?: string[];
}

function run(entries: Manifest['entries'], options: RunOptions = {}) {
  const ends = (abs: string, list: string[] = []) => list.some((p) => abs.replace(/\\/g, '/').endsWith(p));
  return buildChecklist({
    project: options.project ?? defaultProject('Demo'),
    manifest: { version: 1, entries, problems: options.problems ?? [] },
    locales: ['de-DE'],
    outputDir: '/out',
    measure: measureFactory(options.byPath ?? {}, valid63),
    locate: async (abs) => (ends(abs, options.missing) ? 'missing' : ends(abs, options.foreign) ? 'foreign' : 'own'),
  });
}

function item(checklist: Awaited<ReturnType<typeof run>>, specId: string, locale?: string) {
  return checklist.targets.flatMap((t) => t.items).find((i) => i.specId === specId && i.locale === locale);
}

describe('buildChecklist reports what the stores still need', () => {
  test('reports missing required 6.3-inch iPhone screenshots for de-DE as an error', async () => {
    const checklist = await run([]);
    const entry = item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE');
    expect(entry?.status).toBe('error');
    expect(entry?.messages[0]?.text).toContain('is required but missing for de-DE');
    expect(checklist.status).toBe('error');
  });

  test('reports three valid 6.3-inch iPhone screenshots for de-DE as ok', async () => {
    const checklist = await run(screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 3));
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')).toMatchObject({ status: 'ok', messages: [] });
  });

  test('reports a screenshot with alpha by file name', async () => {
    const entries = screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 1);
    const checklist = await run(entries, { byPath: { [entries[0]!.path]: { hasAlpha: true } } });
    const entry = item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE');
    expect(entry?.status).toBe('error');
    expect(entry?.messages.map((m) => m.text)).toEqual([`${entries[0]!.path}: The file has an alpha channel; the store requires an image without transparency`]);
  });

  test('reports eleven screenshots as more than the 10 allowed', async () => {
    const checklist = await run(screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 11));
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')?.messages[0]?.text).toBe(
      'At most 10 files are allowed for de-DE; found 11',
    );
  });

  test('warns about a fallback input and an unverified spec', async () => {
    const shot = { ...screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 1)[0]!, fallbackInput: true };
    const card = outputEntryFactory({ specId: 'web.x-card', locale: 'de-DE', path: 'web/de-DE/share/01-card.png' });
    const checklist = await run([shot, card], { byPath: { 'web/de-DE/share/01-card.png': { width: 1200, height: 628 } } });
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')).toMatchObject({ status: 'warning' });
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')?.messages[0]?.text).toContain('made from the en-US input');
    expect(item(checklist, 'web.x-card', 'de-DE')?.messages.map((m) => m.text)).toContain(
      'Size and limits come from third-party sources, not from the store itself',
    );
  });

  test('leaves out a disabled target', async () => {
    const project = defaultProject('Demo');
    project.targets.google.enabled = false;
    const checklist = await run([], { project });
    expect(checklist.targets.map((t) => t.target)).toEqual(['apple', 'web']);
  });

  test('reports a registered file that no longer exists', async () => {
    const entries = screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 1);
    const checklist = await run(entries, { missing: [entries[0]!.path] });
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')?.messages[0]?.text).toBe(`${entries[0]!.path}: file is missing`);
  });

  test('reports a registered file that is a link to somewhere else', async () => {
    const entries = screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 1);
    const checklist = await run(entries, { foreign: [entries[0]!.path] });
    expect(item(checklist, 'apple.screenshot.iphone-6.3', 'de-DE')?.messages[0]?.text).toContain('is a link or lies outside the output folder');
  });

  test('reports a missing video as an error', async () => {
    const preview = outputEntryFactory({ specId: 'apple.preview.iphone', locale: 'de-DE', path: 'apple/de-DE/preview-iphone/01-p.mp4' });
    const checklist = await run([preview], { missing: [preview.path] });
    expect(item(checklist, 'apple.preview.iphone', 'de-DE')).toMatchObject({ status: 'error' });
  });

  test('makes invalid manifest entries an overall error', async () => {
    const checklist = await run(screenshotEntries('apple.screenshot.iphone-6.3', 'de-DE', 1), {
      problems: ['manifest.json: ../../.ssh/id_rsa: does not match the output layout'],
    });
    expect(checklist.status).toBe('error');
    expect(checklist.problems).toHaveLength(1);
  });

  test('reports the missing shared App Store icon once, without a locale', async () => {
    const checklist = await run([]);
    expect(item(checklist, 'apple.icon')).toMatchObject({ status: 'error', required: true });
  });

  test('checks a preview video against its limits and warns when ffprobe is missing', async () => {
    const preview = outputEntryFactory({ specId: 'apple.preview.iphone', locale: 'de-DE', path: 'apple/de-DE/preview-iphone/01-p.mp4' });
    const video = videoPropsFactory({ format: 'mov,mp4,m4a,3gp,3g2,mj2' });
    const base = { project: defaultProject('Demo'), manifest: { version: 1 as const, entries: [preview], problems: [] }, locales: ['de-DE'] as const, outputDir: '/out', locate: async () => 'own' as const };
    const valid = await buildChecklist({ ...base, measureVideo: async () => video });
    expect(item(valid, 'apple.preview.iphone', 'de-DE')).toMatchObject({ status: 'ok' });
    const tooShort = await buildChecklist({ ...base, measureVideo: async () => ({ ...video, durationSeconds: 9, audioChannels: undefined }) });
    expect(item(tooShort, 'apple.preview.iphone', 'de-DE')?.messages.map((m) => m.text)).toEqual([
      'apple/de-DE/preview-iphone/01-p.mp4: Duration 9 s is outside 15–30 s',
      'apple/de-DE/preview-iphone/01-p.mp4: Audio must have 2 channels (stereo); got no audio track',
    ]);
    const missing = await buildChecklist({ ...base, measureVideo: async () => Promise.reject(new FfmpegMissingError('ffprobe was not found')) });
    expect(item(missing, 'apple.preview.iphone', 'de-DE')).toMatchObject({ status: 'warning', messages: [{ text: 'apple/de-DE/preview-iphone/01-p.mp4: not measured: ffprobe was not found' }] });
  });

  test('lists the chosen devices that have no files yet as warnings', async () => {
    const checklist = await run([]);
    expect(item(checklist, 'apple.screenshot.iphone-6.9', 'de-DE')).toMatchObject({ status: 'warning' });
  });
});

describe('checklistMarkdown renders the checklist for the ZIP', () => {
  test('names the project, the locales and every item with its status', async () => {
    const markdown = checklistMarkdown(await run([]), 'Demo');
    expect(markdown).toContain('# Export checklist: Demo');
    expect(markdown).toContain('Locales: de-DE');
    expect(markdown).toMatch(/- \*\*ERROR\*\* iPhone 6\.3" \(Dynamic Island medium\) \(de-DE\): 0 file\(s\)/);
  });
});
