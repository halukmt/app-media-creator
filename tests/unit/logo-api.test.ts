// conventions: RULE-TESTING-3301
import { readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { registerOutput } from '../../src/core/export/index.js';
import { defaultLogoSettings, saveInput, validateLogoSettings, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { pngBytes, svgBytes, workspaceFactory } from '../factories/workspace.js';

const appFor = (workspace: Workspace) => createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
const put = (body: unknown) => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('Logo settings are stored in the workspace', () => {
  test('returns defaults, then stores packs, background and taglines', async () => {
    const app = appFor(await workspaceFactory());
    expect(await (await app.request('/api/logo/settings')).json()).toEqual(defaultLogoSettings());
    const settings = { packs: ['web', 'social'], background: '#003a72', taglines: { 'tr-TR': '  Şampiyon  ' } };
    expect((await app.request('/api/logo/settings', put(settings))).status).toBe(200);
    expect(await (await app.request('/api/logo/settings')).json()).toEqual({ version: 1, packs: ['web', 'social'], background: '#003a72', taglines: { 'tr-TR': 'Şampiyon' } });
  });

  test('rejects unknown packs, colours and locales', () => {
    const result = validateLogoSettings({ packs: ['tv'], background: 'red', taglines: { 'pt-BR': 'x' } });
    expect(result.ok ? [] : result.errors.map((e) => e.split(':')[0])).toEqual(['packs.0', 'background']);
    const locale = validateLogoSettings({ packs: [], background: '#ffffff', taglines: { 'pt-BR': 'x' } });
    expect(locale.ok ? [] : locale.errors).toEqual(['taglines.pt-BR: not a supported locale']);
  });
});

describe('The logo preview is a rasterized PNG', () => {
  test('serves an SVG logo as a 256 px PNG, never as SVG', async () => {
    const workspace = await workspaceFactory();
    await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    const response = await appFor(workspace).request('/api/inputs/logo-preview');
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('content-security-policy')).toContain('sandbox');
    expect((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width).toBe(256);
  });

  test('answers 404 without a logo', async () => {
    expect((await appFor(await workspaceFactory()).request('/api/inputs/logo-preview')).status).toBe(404);
  });
});

describe('Generated images are served for previews', () => {
  test('lists the manifest entries and serves a registered PNG with safe headers', async () => {
    const workspace = await workspaceFactory();
    const entry = await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes(1024, 1024) });
    const app = appFor(workspace);
    expect(((await (await app.request('/api/output')).json()) as { path: string }[]).map((e) => e.path)).toEqual([entry.path]);
    const response = await app.request(`/api/output/file?path=${encodeURIComponent(entry.path)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('refuses paths outside the manifest, documents and files replaced by links', async () => {
    const workspace = await workspaceFactory();
    const doc = await registerOutput(workspace, { specId: 'web.webmanifest', order: 1, name: 'site', extension: 'webmanifest', bytes: new TextEncoder().encode('{}') });
    const icon = await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes(1024, 1024) });
    const app = appFor(workspace);
    for (const p of [doc.path, 'manifest.json', '../project.json', '']) {
      expect((await app.request(`/api/output/file?path=${encodeURIComponent(p)}`)).status).toBe(404);
    }
    // A registered image swapped for a link to a file elsewhere is not served.
    const target = path.join(workspace.root, 'secret.png');
    writeFileSync(target, await pngBytes(10, 10));
    const file = path.join(workspace.outputDir, icon.path);
    rmSync(file);
    try {
      symlinkSync(target, file);
    } catch {
      return; // Creating links needs extra rights on Windows; the check is covered on Linux CI.
    }
    expect((await app.request(`/api/output/file?path=${encodeURIComponent(icon.path)}`)).status).toBe(404);
  });
});

describe('Logo packs are generated from the saved settings', () => {
  test('generates the web pack with the saved background and lists it with pack and size', async () => {
    const workspace = await workspaceFactory();
    await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    const app = appFor(workspace);
    await app.request('/api/logo/settings', put({ packs: ['web'], background: '#003a72', taglines: {} }));
    const response = await app.request('/api/generate/logo/web', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(201);
    const outputs = (await (await app.request('/api/logo/output')).json()) as { path: string; pack: string; width?: number }[];
    const touch = outputs.find((o) => o.path.endsWith('apple-touch-icon.png'));
    expect(touch).toMatchObject({ pack: 'web', width: 180 });
    // The touch icon is opaque on the saved background colour.
    const png = readFileSync(path.join(workspace.outputDir, touch!.path));
    const { data } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2]]).toEqual([0x00, 0x3a, 0x72]);
    // A smaller copy for the preview grid.
    const small = await app.request(`/api/output/file?path=${encodeURIComponent(touch!.path)}&width=64`);
    expect((await sharp(Buffer.from(await small.arrayBuffer())).metadata()).width).toBe(64);
  });

  test('rejects an unknown pack and asks for a logo', async () => {
    const app = appFor(await workspaceFactory());
    const post = (pack: string) => app.request(`/api/generate/logo/${pack}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect((await post('tv')).status).toBe(400);
    expect(await (await post('app-store')).json()).toEqual({ error: 'Upload a logo first' });
  });
});

describe('The current logo comes with its size and checks (#64)', () => {
  test('warns about a raster logo smaller than the App Store icon and not square', async () => {
    const workspace = await workspaceFactory();
    await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.png', bytes: await pngBytes(300, 200) });
    const info = await (await appFor(workspace).request('/api/inputs/logo-info')).json();
    expect(info).toMatchObject({ format: 'png', width: 300, height: 200, isSvg: false, status: 'warning' });
    expect(info.messages).toEqual([
      'Smaller than the 1024 px App Store icon (200 px); the larger icons are upscaled and may look soft',
      'Not square; the icons show it centred with space around it',
    ]);
  });

  test('accepts a square SVG logo of any declared size and answers 404 without a logo', async () => {
    const workspace = await workspaceFactory();
    const app = appFor(workspace);
    expect((await app.request('/api/inputs/logo-info')).status).toBe(404);
    await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    expect(await (await app.request('/api/inputs/logo-info')).json()).toEqual({ format: 'svg', width: 64, height: 64, isSvg: true, status: 'ok', messages: [] });
  });
});

describe('Resized output previews follow the file on disk (#64)', () => {
  test('serves a new preview after the generated file was replaced', async () => {
    const workspace = await workspaceFactory();
    const entry = await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes(1024, 1024) });
    const app = appFor(workspace);
    const previewHeight = async () =>
      (await sharp(Buffer.from(await (await app.request(`/api/output/file?path=${encodeURIComponent(entry.path)}&width=64`)).arrayBuffer())).metadata()).height;
    expect(await previewHeight()).toBe(64);
    expect(await previewHeight()).toBe(64);
    writeFileSync(path.join(workspace.outputDir, entry.path), await pngBytes(1024, 512));
    expect(await previewHeight()).toBe(32);
  });
});
