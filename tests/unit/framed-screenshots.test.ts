// conventions: RULE-TESTING-3301
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist, readManifest } from '../../src/core/export/index.js';
import { generateFramedScreenshots } from '../../src/core/generators/framed-screenshots.js';
import { renderFramedScreenshot } from '../../src/core/screenshots/index.js';
import { getSpec, inspectImageBytes, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot } from '../factories/screenshots.js';
import { workspaceFactory } from '../factories/workspace.js';

/** A workspace with one screenshot each for German and Turkish. */
async function workspaceWithScreenshots(): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const bytes = await appScreenshot(590, 1278);
  for (const locale of ['de-DE', 'tr-TR']) {
    await saveInput(workspace, 'en-US', { kind: 'screenshot', locale, originalName: 'start.png', bytes });
  }
  return workspace;
}

async function alphaAt(png: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels + 3]!;
}

describe('renderFramedScreenshot draws a device on transparency', () => {
  test('keeps the corners transparent and the device opaque', async () => {
    const png = await renderFramedScreenshot({ screenshot: await appScreenshot(590, 1278), frame: 'iphone', deviceWidth: 400 });
    // For a visual check: the same image on a coloured backdrop.
    mkdirSync('test-results/cards', { recursive: true });
    await sharp(png).flatten({ background: '#f4c7a1' }).toFile('test-results/cards/framed-iphone.png');
    const { width, height, hasAlpha } = await inspectImageBytes(png);
    expect(hasAlpha).toBe(true);
    expect(width).toBeGreaterThan(400);
    expect(await alphaAt(png, 0, 0)).toBe(0);
    expect(await alphaAt(png, Math.round(width / 2), Math.round(height / 2))).toBe(255);
  });

  test('is exactly the device width without a shadow', async () => {
    const png = await renderFramedScreenshot({ screenshot: await appScreenshot(590, 1278), frame: 'android-phone', deviceWidth: 400, shadow: false });
    expect((await inspectImageBytes(png)).width).toBe(400);
  });

  test('rejects an unknown frame and a width out of range', async () => {
    const screenshot = await appScreenshot(100, 200);
    await expect(renderFramedScreenshot({ screenshot, frame: 'watch' as 'iphone', deviceWidth: 400 })).rejects.toThrow(/Unknown frame/);
    await expect(renderFramedScreenshot({ screenshot, frame: 'iphone', deviceWidth: 0 })).rejects.toThrow(/Device width/);
  });
});

describe('generateFramedScreenshots writes website screenshots per locale', () => {
  test('writes PNG and WebP in 1x and 2x for every locale with own screenshots', async () => {
    const workspace = await workspaceWithScreenshots();
    const entries = await generateFramedScreenshots(workspace);
    expect(entries.map((e) => e.path).sort()).toEqual([
      'web/de-DE/framed-screenshots/1x/01-start.png',
      'web/de-DE/framed-screenshots/1x/01-start.webp',
      'web/de-DE/framed-screenshots/2x/01-start.png',
      'web/de-DE/framed-screenshots/2x/01-start.webp',
      'web/tr-TR/framed-screenshots/1x/01-start.png',
      'web/tr-TR/framed-screenshots/1x/01-start.webp',
      'web/tr-TR/framed-screenshots/2x/01-start.png',
      'web/tr-TR/framed-screenshots/2x/01-start.webp',
    ]);
    expect((await readManifest(workspace)).entries).toHaveLength(8);
  });

  test('makes the 2x image twice as large as the 1x image, with alpha, valid for its spec', async () => {
    const workspace = await workspaceWithScreenshots();
    await generateFramedScreenshots(workspace, { locales: 'de-DE' });
    const read = async (file: string) => inspectImageBytes(readFileSync(path.join(workspace.outputDir, file)));
    const one = await read('web/de-DE/framed-screenshots/1x/01-start.png');
    const two = await read('web/de-DE/framed-screenshots/2x/01-start.png');
    const webp = await read('web/de-DE/framed-screenshots/2x/01-start.webp');
    expect(Math.abs(two.width - 2 * one.width)).toBeLessThanOrEqual(1);
    expect([one.hasAlpha, webp.hasAlpha, webp.format]).toEqual([true, true, 'webp']);
    expect(validateMedia(getSpec('web.framed-screenshot'), one)).toEqual([]);
    expect(validateMedia(getSpec('web.framed-screenshot-webp'), webp)).toEqual([]);
  });

  test('skips locales without own screenshots and lists the files as ok in the checklist', async () => {
    const workspace = await workspaceWithScreenshots();
    const entries = await generateFramedScreenshots(workspace, { locales: ['de-DE', 'fr-FR'] });
    expect(entries.every((e) => e.locale === 'de-DE')).toBe(true);
    const checklist = await exportChecklist(workspace, { locales: ['de-DE'] });
    const items = checklist.targets.find((t) => t.target === 'web')!.items.filter((i) => i.specId.startsWith('web.framed-screenshot'));
    expect(items.map((i) => [i.specId, i.status])).toEqual([
      ['web.framed-screenshot', 'ok'],
      ['web.framed-screenshot-webp', 'ok'],
    ]);
  });

  test('asks for screenshots when the selected locales have none', async () => {
    const workspace = await workspaceFactory();
    await expect(generateFramedScreenshots(workspace, { locales: 'fr-FR' })).rejects.toThrow('Upload screenshots for fr-FR first');
  });

  test('removes the files of a deleted screenshot when generating again', async () => {
    const workspace = await workspaceWithScreenshots();
    const second = await saveInput(workspace, 'en-US', { kind: 'screenshot', locale: 'de-DE', originalName: 'teams.png', bytes: await appScreenshot(590, 1278) });
    await generateFramedScreenshots(workspace, { locales: 'de-DE' });
    expect((await readManifest(workspace)).entries).toHaveLength(8);

    rmSync(path.join(workspace.root, second.path));
    await generateFramedScreenshots(workspace, { locales: 'de-DE' });
    const paths = (await readManifest(workspace)).entries.map((e) => e.path);
    expect(paths).toHaveLength(4);
    expect(paths.some((p) => p.includes('teams'))).toBe(false);
    expect(existsSync(path.join(workspace.outputDir, 'web/de-DE/framed-screenshots/1x/02-teams.png'))).toBe(false);
  });

  test('names the file when a screenshot is too tall for the website sizes', async () => {
    const workspace = await workspaceFactory();
    await saveInput(workspace, 'en-US', { kind: 'screenshot', locale: 'de-DE', originalName: 'page.png', bytes: await appScreenshot(400, 6000) });
    await expect(generateFramedScreenshots(workspace, { locales: 'de-DE' })).rejects.toThrow(/page\.png: The framed image would be \d+×\d+ px; allowed are 100 to 4096 px/);
  });

  test('reports a broken user bezel as a generator error that names it', async () => {
    const workspace = await workspaceWithScreenshots();
    mkdirSync(workspace.userFramesDir, { recursive: true });
    writeFileSync(path.join(workspace.userFramesDir, 'iphone.png'), await sharp({ create: { width: 10, height: 20, channels: 4, background: '#000' } }).png().toBuffer());
    writeFileSync(path.join(workspace.userFramesDir, 'iphone.json'), '{ broken');
    await expect(generateFramedScreenshots(workspace)).rejects.toThrow(/frames\/user\/iphone: .*not valid JSON/);
  });
});

describe('A user bezel gets the same shadow as the generic frames', () => {
  test('keeps semi-transparent bezel pixels as transparent as in the bezel file, apart from the shadow', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'amc-frames-'));
    // A red ring at 50 % alpha with an empty screen opening.
    const bezel = await sharp({ create: { width: 100, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } })
      .composite([{ input: { create: { width: 80, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }, left: 10, top: 10, blend: 'dest-out' }])
      .png()
      .toBuffer();
    writeFileSync(path.join(dir, 'ipad.png'), bezel);
    writeFileSync(path.join(dir, 'ipad.json'), JSON.stringify({ width: 100, height: 200, screen: { x: 10, y: 10, width: 80, height: 180 } }));
    const png = await renderFramedScreenshot({ screenshot: await appScreenshot(160, 360), frame: 'ipad', deviceWidth: 400, userFramesDir: dir });
    const margin = ((await inspectImageBytes(png)).width - 400) / 2;
    // Middle of the left ring: 50 % artwork plus a faint shadow beneath; drawn twice it would be 75 % or more.
    const alpha = await alphaAt(png, Math.round(margin + 20), Math.round(margin + 400));
    expect(alpha).toBeGreaterThan(128);
    expect(alpha).toBeLessThan(180);
  });

  test('draws a shadow below the bezel inside the margin', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'amc-frames-'));
    const bezel = await sharp({ create: { width: 100, height: 200, channels: 4, background: '#202020' } })
      .composite([{ input: { create: { width: 80, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }, left: 10, top: 10, blend: 'dest-out' }])
      .png()
      .toBuffer();
    writeFileSync(path.join(dir, 'ipad.png'), bezel);
    writeFileSync(path.join(dir, 'ipad.json'), JSON.stringify({ width: 100, height: 200, screen: { x: 10, y: 10, width: 80, height: 180 } }));
    const png = await renderFramedScreenshot({ screenshot: await appScreenshot(160, 360), frame: 'ipad', deviceWidth: 400, userFramesDir: dir });
    const { width, height } = await inspectImageBytes(png);
    // Just below the bezel's bottom edge, in the middle: the shadow, partly transparent.
    const below = await alphaAt(png, Math.round(width / 2), height - Math.round((height - 800) / 2) + 6);
    expect(below).toBeGreaterThan(0);
    expect(below).toBeLessThan(255);

    // Inside the screen opening, right next to its left edge: the white screenshot, not darkened by the shadow.
    const margin = (width - 400) / 2;
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
    const inside = at(Math.round(margin + 10 * 4 + 2), Math.round(margin + 100 * 4));
    expect(Math.min(...inside)).toBeGreaterThanOrEqual(250);
  });
});

describe('The generate API builds framed screenshots', () => {
  const post = async (workspace: Workspace, body: unknown) =>
    createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace }).request(
      'http://localhost:4790/api/generate/framed-screenshots',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) },
    );

  test('generates the files for one locale without a shadow', async () => {
    const response = await post(await workspaceWithScreenshots(), { locales: 'tr-TR', frame: 'android-phone', shadow: false });
    expect(response.status).toBe(201);
    expect(((await response.json()) as unknown[]).length).toBe(4);
  });

  test('rejects an unknown frame and an unsupported locale with 400', async () => {
    const workspace = await workspaceWithScreenshots();
    expect((await post(workspace, { frame: '../../etc' })).status).toBe(400);
    expect((await post(workspace, { locales: 'pt-BR' })).status).toBe(400);
  });
});
