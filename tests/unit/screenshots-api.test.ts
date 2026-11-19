// conventions: RULE-TESTING-3301
import { rmSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { readManifest } from '../../src/core/export/index.js';
import { generateScreenshotCards, renderCardPreview } from '../../src/core/generators/screenshot-cards.js';
import { readScreenshotSets, saveInput, saveProject, saveScreenshotSets, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot } from '../factories/screenshots.js';
import { projectInputFactory, svgBytes, workspaceFactory } from '../factories/workspace.js';

async function workspaceWithShot(): Promise<{ workspace: Workspace; input: string }> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, { ...projectInputFactory(), sourceLocale: 'de-DE' });
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  const input = await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: 'start.png', bytes: await appScreenshot(118, 256) });
  return { workspace, input: input.path };
}

const appFor = (workspace: Workspace) => createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });

describe('Uploaded screenshots are served for thumbnails', () => {
  test('serves a listed screenshot with headers that stop scripts and sniffing', async () => {
    const { workspace, input } = await workspaceWithShot();
    const response = await appFor(workspace).request(`/api/inputs/file?path=${encodeURIComponent(input)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width).toBe(118);
  });

  test('refuses paths that are not screenshot uploads, including the logo and traversal', async () => {
    const { workspace } = await workspaceWithShot();
    const logo = await saveInput(workspace, 'de-DE', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    const app = appFor(workspace);
    for (const path of [logo.path, 'project.json', '../../etc/passwd', '']) {
      expect((await app.request(`/api/inputs/file?path=${encodeURIComponent(path)}`)).status).toBe(404);
    }
  });
});

describe('Card previews show one slot small, with the warnings of the full card', () => {
  test('renders a small card with the device aspect ratio', async () => {
    const { workspace } = await workspaceWithShot();
    const preview = await renderCardPreview(workspace, { locale: 'de-DE', device: 'apple.screenshot.iphone-6.3', index: 0 });
    const meta = await sharp(preview.png).metadata();
    expect([meta.width, meta.height]).toEqual([360, Math.round((360 * 2556) / 1179)]);
    expect(preview.fallbackInput).toBe(false);
  });

  test('marks a preview of a fallback locale and reports text warnings', async () => {
    const { workspace, input } = await workspaceWithShot();
    const sets = await readScreenshotSets(workspace);
    sets.sets['de-DE'] = [{ input, headline: 'W'.repeat(80), subline: '' }];
    await saveScreenshotSets(workspace, sets);
    const preview = await renderCardPreview(workspace, { locale: 'tr-TR', device: 'google.screenshot.phone', index: 0 });
    expect(preview.fallbackInput).toBe(true);
    expect(preview.warnings.map((w) => w.code)).toContain('word-broken');
  });

  test('previews only the project\'s languages, like generating', async () => {
    const { workspace } = await workspaceWithShot();
    const saved = await saveProject(workspace, { ...projectInputFactory(), sourceLocale: 'de-DE', locales: ['de-DE', 'en-US'] });
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await expect(renderCardPreview(workspace, { locale: 'fr-FR', device: 'apple.screenshot.iphone-6.3', index: 0 })).rejects.toThrow('fr-FR is not a locale of this project');
    const response = await appFor(workspace).request('/api/generate/screenshot-cards', { method: 'POST', body: JSON.stringify({ locales: 5 }), headers: { 'content-type': 'application/json' } });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'locales must be "all", a locale id or a list of locale ids' });
  });

  test('applies a slot override: no frame on a slot changes the card', async () => {
    const { workspace, input } = await workspaceWithShot();
    const framed = await renderCardPreview(workspace, { locale: 'de-DE', device: 'apple.screenshot.iphone-6.3', index: 0 });
    const sets = await readScreenshotSets(workspace);
    sets.sets['de-DE'] = [{ input, headline: '', subline: '', frame: 'none', layout: 'text-bottom' }];
    await saveScreenshotSets(workspace, sets);
    const plain = await renderCardPreview(workspace, { locale: 'de-DE', device: 'apple.screenshot.iphone-6.3', index: 0 });
    expect(plain.png.equals(framed.png)).toBe(false);
    expect((await readScreenshotSets(workspace)).sets['de-DE']?.[0]).toMatchObject({ frame: 'none', layout: 'text-bottom' });
  });

  test('rejects a device outside the matrix and a missing slot through the API', async () => {
    const { workspace } = await workspaceWithShot();
    const app = appFor(workspace);
    const post = (body: unknown) =>
      app.request('/api/screenshots/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post({ locale: 'de-DE', device: 'apple.screenshot.apple-tv', index: 0 })).status).toBe(400);
    expect((await post({ locale: 'de-DE', device: 'apple.screenshot.iphone-6.3', index: 5 })).status).toBe(400);
    const ok = await post({ locale: 'de-DE', device: 'apple.screenshot.iphone-6.3', index: 0, width: 200 });
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { image: string }).image).toMatch(/^data:image\/png;base64,/);
  });
});

describe('Background choices come from the server', () => {
  test('lists the presets and, without a logo, no palette', async () => {
    const { workspace } = await workspaceWithShot();
    const body = (await (await appFor(workspace).request('/api/screenshots/backgrounds')).json()) as { presets: { id: string }[]; palette: unknown[] };
    expect(body.presets.map((p) => p.id)).toContain('deep-blue');
    expect(body.palette).toEqual([]);
  });

  test('adds backgrounds from the logo colours once a logo is uploaded', async () => {
    const { workspace } = await workspaceWithShot();
    await saveInput(workspace, 'de-DE', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    const body = (await (await appFor(workspace).request('/api/screenshots/backgrounds')).json()) as { palette: { id: string }[] };
    expect(body.palette.length).toBeGreaterThan(0);
  });
});

describe('Generation per language keeps the outputs tidy', () => {
  test('removes the old cards of a language that has no screenshots any more', async () => {
    const { workspace, input } = await workspaceWithShot();
    const turkish = await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'tr-TR', originalName: 'tr.png', bytes: await appScreenshot(118, 256) });
    const project = await saveProject(workspace, { ...projectInputFactory(), sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], targets: { apple: { enabled: true, devices: ['apple.screenshot.iphone-6.3'] }, google: { enabled: false, devices: [] }, web: { enabled: true, devices: [] } } });
    expect(project.ok).toBe(true);
    await generateScreenshotCards(workspace);
    rmSync(path.join(workspace.root, input));
    const result = await generateScreenshotCards(workspace, { locales: 'de-DE' });
    expect(result.skipped).toEqual(['de-DE']);
    expect((await readManifest(workspace)).entries.map((e) => e.path)).toEqual([`apple/tr-TR/iphone-6.3/01-tr.png`]);
    expect(turkish.path).toContain('tr-TR');
  });

  test('says in the preview when a screenshot is beyond the store maximum', async () => {
    const { workspace } = await workspaceWithShot();
    for (let i = 2; i <= 9; i += 1) await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: `s${i}.png`, bytes: await appScreenshot(118, 256) });
    const preview = await renderCardPreview(workspace, { locale: 'de-DE', device: 'google.screenshot.phone', index: 8, width: 120 });
    expect(preview.warnings.map((w) => w.code)).toContain('not-exported');
  });
});
