// conventions: RULE-TESTING-3301
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist } from '../../src/core/export/index.js';
import { CREATIVE_IMAGES, generateCreativeAssets, renderCreativePreview } from '../../src/core/generators/creative-assets.js';
import { creativeLayout, outerAspect, renderCreativeAsset, type CreativeInput } from '../../src/core/screenshots/index.js';
import { getSpec, inspectImageBytes, validateMedia, type Rect } from '../../src/core/specs/index.js';
import {
  readCreativeSettings,
  saveCreativeSettings,
  saveInput,
  saveProject,
  validateCreativeSettings,
  type Workspace,
} from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot, creativePhrases, gradientBackground } from '../factories/screenshots.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const PHRASES = creativePhrases();
const LOCALES = ['de-DE', 'tr-TR'] as const;

/** A workspace with German and Turkish only, one screenshot for German and phrases for both. */
async function creativeWorkspace(options: { phrases?: Record<string, string>; apple?: boolean } = {}): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const project = projectInputFactory({ sourceLocale: 'de-DE', locales: [...LOCALES] }) as { targets: Record<string, { enabled: boolean }> };
  if (options.apple === false) project.targets.apple!.enabled = false;
  const saved = await saveProject(workspace, project);
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: 'start.png', bytes: await appScreenshot(590, 1278) });
  const settings = await saveCreativeSettings(workspace, { background: gradientBackground(), phrases: options.phrases ?? PHRASES });
  if (!settings.ok) throw new Error(settings.errors.join('; '));
  return workspace;
}

const within = (box: Rect, area: Rect) =>
  box.x >= area.x - 0.01 && box.y >= area.y - 0.01 && box.x + box.width <= area.x + area.width + 0.01 && box.y + box.height <= area.y + area.height + 0.01;

/** A small render of a spec: its size and safe area scaled to `width`. */
function scaledInput(specId: string, width: number, phrase: string, screenshots: Uint8Array[]): CreativeInput {
  const spec = getSpec(specId);
  const full = spec.dimensions.kind === 'fixed' ? spec.dimensions.sizes[0]! : spec.defaultSize!;
  const scale = width / full.width;
  const s = spec.safeArea!;
  return {
    width,
    height: Math.round(full.height * scale),
    safeArea: { x: s.x * scale, y: s.y * scale, width: s.width * scale, height: s.height * scale },
    background: { kind: 'solid', color: '#003a72' },
    phrase,
    screenshots,
    userFrame: null,
  };
}

describe('The creative layout keeps the key art inside the art safe area', () => {
  for (const { specId } of CREATIVE_IMAGES) {
    test(`places phrase and device of ${specId} inside the safe area and the side devices outside it`, () => {
      const spec = getSpec(specId);
      const size = spec.dimensions.kind === 'fixed' ? spec.dimensions.sizes[0]! : spec.defaultSize!;
      const safe = spec.safeArea!;
      for (const hasText of [true, false]) {
        const layout = creativeLayout(size.width, size.height, safe, outerAspect('iphone', 2556 / 1179), hasText);
        expect(within(layout.device, safe)).toBe(true);
        if (hasText) {
          expect(layout.text && within(layout.text, safe)).toBe(true);
          expect(layout.text!.x + layout.text!.width).toBeLessThanOrEqual(layout.device.x);
        } else expect(layout.text).toBeNull();
        expect(layout.sides.filter((side) => side.x < safe.x).length).toBeGreaterThan(0);
        expect(layout.sides.filter((side) => side.x > safe.x).length).toBeGreaterThan(0);
        for (const side of layout.sides) {
          const overlaps = side.x < safe.x + safe.width && side.x + side.width > safe.x;
          expect(overlaps).toBe(false);
          expect(side.x + side.width).toBeGreaterThan(0);
          expect(side.x).toBeLessThan(size.width);
          expect(side.opacity).toBeLessThan(1);
        }
      }
    });
  }
});

describe('renderCreativeAsset draws the header image', () => {
  test('changes only pixels inside the safe area when the phrase changes (de-DE vs tr-TR)', async () => {
    const shots = [await appScreenshot(295, 639)];
    const german = scaledInput('apple.creative.header-image', 960, PHRASES['de-DE'], shots);
    const turkish = { ...german, phrase: PHRASES['tr-TR'] };
    const [a, b] = await Promise.all([renderCreativeAsset(german), renderCreativeAsset(turkish)]);
    expect([...a.warnings, ...b.warnings]).toEqual([]);
    const meta = await sharp(a.png).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([960, german.height, false]);
    const [pa, pb] = await Promise.all([a.png, b.png].map((png) => sharp(png).raw().toBuffer()));
    const s = german.safeArea;
    let changed = 0;
    let outside = 0;
    for (let i = 0; i < pa!.length; i += 3) {
      if (pa![i] === pb![i] && pa![i + 1] === pb![i + 1] && pa![i + 2] === pb![i + 2]) continue;
      changed += 1;
      const pixel = i / 3;
      const x = pixel % 960;
      const y = Math.floor(pixel / 960);
      if (x < s.x - 1 || x > s.x + s.width + 1 || y < s.y - 1 || y > s.y + s.height + 1) outside += 1;
    }
    expect(changed).toBeGreaterThan(100);
    expect(outside).toBe(0);
  });

  test('rejects a safe area outside the image and an empty screenshot list', async () => {
    const input = scaledInput('apple.creative.header-image', 640, 'Hi', [await appScreenshot(100, 216)]);
    await expect(renderCreativeAsset({ ...input, safeArea: { x: 600, y: 0, width: 100, height: 50 } })).rejects.toThrow(/inside the image/);
    await expect(renderCreativeAsset({ ...input, screenshots: [] })).rejects.toThrow(/at least one screenshot/);
  });
});

describe('Creative settings hold a background and one phrase per locale', () => {
  test('keeps phrases of supported locales and drops blank ones', () => {
    const result = validateCreativeSettings({ background: gradientBackground(), phrases: { 'de-DE': '  Faire Teams ', 'tr-TR': '  ' } });
    expect(result.ok && result.settings.phrases).toEqual({ 'de-DE': 'Faire Teams' });
  });

  test('rejects an unknown locale, a phrase over 60 characters and a bad background', () => {
    const result = validateCreativeSettings({ background: { kind: 'solid', color: 'red' }, phrases: { 'pt-BR': 'Olá', 'de-DE': 'x'.repeat(61) } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(' ')).toMatch(/background/);
      expect(result.errors.join(' ')).toMatch(/at most 60 characters/);
    }
    expect(validateCreativeSettings({ background: gradientBackground(), phrases: { 'pt-BR': 'Olá' } })).toEqual({ ok: false, errors: ['phrases.pt-BR: not a supported locale'] });
  });

  test('reads the defaults when nothing is stored', async () => {
    const settings = await readCreativeSettings(await workspaceFactory());
    expect(settings.phrases).toEqual({});
    expect(settings.background.kind).toBe('gradient');
  });
});

describe('generateCreativeAssets writes the header, search and universal images per locale', () => {
  test('writes three valid PNGs per locale, Turkish from the German screenshots as fallback input', async () => {
    const workspace = await creativeWorkspace();
    const result = await generateCreativeAssets(workspace);
    expect(result.warnings).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.entries.map((e) => e.path).sort()).toEqual(
      LOCALES.flatMap((locale) => [
        `apple/${locale}/creative-header-image/01-header.png`,
        `apple/${locale}/creative-search-image/01-search.png`,
        `apple/${locale}/creative-universal-image/01-universal.png`,
      ]).sort(),
    );
    expect(result.entries.find((e) => e.locale === 'tr-TR')?.fallbackInput).toBe(true);
    for (const entry of result.entries) {
      const props = await inspectImageBytes(await sharp(`${workspace.outputDir}/${entry.path}`).toBuffer());
      expect(validateMedia(getSpec(entry.specId), props), entry.path).toEqual([]);
    }
    const apple = (await exportChecklist(workspace, { locales: ['de-DE'] })).targets.find((t) => t.target === 'apple');
    const header = apple?.items.find((i) => i.specId === 'apple.creative.header-image' && i.locale === 'de-DE');
    expect(header?.status).toBe('ok');
  }, 120_000);

  test('warns about a locale without a phrase and still renders its images', async () => {
    const workspace = await creativeWorkspace({ phrases: { 'de-DE': PHRASES['de-DE'] } });
    const preview = await renderCreativePreview(workspace, { locale: 'tr-TR', specId: 'apple.creative.header-image', width: 320 });
    expect(preview.warnings.map((w) => w.code)).toEqual(['missing-phrase']);
    expect(preview.width).toBe(320);
  });

  test('asks to enable the App Store and rejects specs that are not creative images', async () => {
    await expect(generateCreativeAssets(await creativeWorkspace({ apple: false }))).rejects.toThrow(/Enable the App Store/);
    const workspace = await creativeWorkspace();
    await expect(renderCreativePreview(workspace, { locale: 'de-DE', specId: 'apple.icon' })).rejects.toThrow(/not a header or search image/);
  });
});

describe('The creative API', () => {
  test('stores the settings and returns a preview with the safe area as shares of the image', async () => {
    const workspace = await creativeWorkspace();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const put = await app.request('http://localhost:4790/api/creative/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ background: gradientBackground(), phrases: { 'tr-TR': PHRASES['tr-TR'] } }),
    });
    expect(put.status).toBe(200);
    const response = await app.request('http://localhost:4790/api/creative/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'tr-TR', specId: 'apple.creative.universal-image', width: 400 }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { image: string; safeArea: Rect; warnings: unknown[] };
    expect(body.image).toMatch(/^data:image\/png;base64,/);
    expect(body.safeArea.x).toBeCloseTo(1921 / 5244, 5);
    expect(body.safeArea.width).toBeCloseTo(1402 / 5244, 5);
    expect(body.warnings).toEqual([]);
  });

  test('answers 400 for a bad request body and an invalid phrase', async () => {
    const workspace = await creativeWorkspace();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const preview = await app.request('http://localhost:4790/api/creative/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'de-DE' }),
    });
    expect(preview.status).toBe(400);
    const put = await app.request('http://localhost:4790/api/creative/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ background: gradientBackground(), phrases: { 'de-DE': 'x'.repeat(61) } }),
    });
    expect(put.status).toBe(400);
  });
});
