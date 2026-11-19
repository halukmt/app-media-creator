// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist } from '../../src/core/export/index.js';
import { GeneratorError } from '../../src/core/generators/logo.js';
import { generateWebIcons } from '../../src/core/generators/web-icons.js';
import { getSpec, inspectImage, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { projectInputFactory, svgBytes, workspaceFactory } from '../factories/workspace.js';

async function transparentPng(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 120, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: { create: { width: 100, height: 100, channels: 4, background: '#cc2200' } }, left: 100, top: 10 }])
      .png()
      .toBuffer(),
  );
}

async function withLogo(bytes: Uint8Array, name: string): Promise<Workspace> {
  const workspace = await workspaceFactory();
  await saveProject(workspace, projectInputFactory({ name: 'Demo' }));
  await saveInput(workspace, 'en-US', { kind: 'logo', originalName: name, bytes });
  return workspace;
}

const folder = (workspace: Workspace) => path.join(workspace.outputDir, 'web/shared/favicons');

describe('generateWebIcons builds the favicon set from the logo', () => {
  test('writes every file into web/shared/favicons and the checklist has no errors for them', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    const entries = (await generateWebIcons(workspace)).filter((e) => e.environment === undefined);
    expect(entries.map((e) => path.posix.basename(e.path)).sort()).toEqual([
      'apple-touch-icon.png',
      'favicon.ico',
      'head.html',
      'icon-192.png',
      'icon-512.png',
      'icon-maskable-512.png',
      'icon.svg',
      'site.webmanifest',
    ]);
    const checklist = await exportChecklist(workspace);
    const web = checklist.targets.find((t) => t.target === 'web');
    const errors = web?.items.filter((i) => i.files.length > 0).flatMap((i) => i.messages.filter((m) => m.level === 'error'));
    expect(errors).toEqual([]);
  });

  test('produces each image in the size of its catalogue entry', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateWebIcons(workspace);
    const checks: [string, string][] = [
      ['favicon.ico', 'web.favicon-ico'],
      ['apple-touch-icon.png', 'web.apple-touch-icon'],
      ['icon-192.png', 'web.manifest-icon'],
      ['icon-512.png', 'web.manifest-icon'],
      ['icon-maskable-512.png', 'web.maskable-icon'],
    ];
    for (const [file, specId] of checks) {
      const props = await inspectImage(path.join(folder(workspace), file));
      expect(validateMedia(getSpec(specId), props), file).toEqual([]);
    }
    expect(await inspectImage(path.join(folder(workspace), 'favicon.ico'))).toMatchObject({ width: 48, height: 48, format: 'ico' });
  });

  test('puts a transparent PNG logo on the opaque background for the touch and maskable icons', async () => {
    const workspace = await withLogo(await transparentPng(), 'logo.png');
    await generateWebIcons(workspace, { background: '#336699' });
    for (const file of ['apple-touch-icon.png', 'icon-maskable-512.png']) {
      const image = sharp(path.join(folder(workspace), file));
      expect((await image.metadata()).hasAlpha, file).toBe(false);
      const { data } = await image.extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
      expect([...data], file).toEqual([0x33, 0x66, 0x99]);
    }
  });

  test('switches the icon.svg background in dark mode and embeds the logo as an image', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateWebIcons(workspace, { background: '#ffffff', darkBackground: '#111111' });
    const svg = readFileSync(path.join(folder(workspace), 'icon.svg'), 'utf8');
    expect(svg).toContain('.bg{fill:#ffffff}@media (prefers-color-scheme: dark){.bg{fill:#111111}}');
    expect(svg).toContain('<image href="data:image/svg+xml;base64,');
    expect(svg).not.toContain('<rect width="64"'); // the uploaded markup is not inlined
  });

  test('writes the manifest and the head snippet for the project', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateWebIcons(workspace, { themeColor: '#0079dd' });
    const manifest = JSON.parse(readFileSync(path.join(folder(workspace), 'site.webmanifest'), 'utf8')) as {
      name: string;
      theme_color: string;
      icons: { src: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Demo');
    expect(manifest.theme_color).toBe('#0079dd');
    expect(manifest.icons.map((i) => i.src)).toEqual(['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png']);
    const head = readFileSync(path.join(folder(workspace), 'head.html'), 'utf8');
    for (const href of ['/favicon.ico', '/icon.svg', '/apple-touch-icon.png', '/site.webmanifest']) expect(head).toContain(`href="${href}"`);
  });

  test('renders a large SVG logo without a huge intermediate image', async () => {
    const big = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="4000"><circle cx="2000" cy="2000" r="1800" fill="#09f"/></svg>');
    const workspace = await withLogo(big, 'big.svg');
    const entries = (await generateWebIcons(workspace)).filter((e) => e.environment === undefined);
    expect(entries).toHaveLength(8);
  });

  test('uses the most recently changed logo', async () => {
    const workspace = await withLogo(svgBytes(), 'old.svg');
    const { utimesSync } = await import('node:fs');
    const stored = await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'new.png', bytes: await transparentPng() });
    const later = new Date(Date.now() + 60_000);
    utimesSync(path.join(workspace.root, stored.path), later, later);
    await generateWebIcons(workspace);
    const svg = readFileSync(path.join(folder(workspace), 'icon.svg'), 'utf8');
    expect(svg).toContain('data:image/png;base64,');
  });

  test('reports an unreadable logo and an invalid colour as request errors', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await expect(generateWebIcons(workspace, { themeColor: 'red' as never })).rejects.toThrow(new GeneratorError('themeColor must be a colour like #1a2b3c'));
    const logos = (await import('node:fs')).readdirSync(path.join(workspace.inputsDir, 'logo'));
    (await import('node:fs')).writeFileSync(path.join(workspace.inputsDir, 'logo', logos[0]!), 'broken');
    await expect(generateWebIcons(workspace)).rejects.toBeInstanceOf(GeneratorError);
  });

  test('renders a JPEG logo rotated by EXIF upright', async () => {
    // Stored 120×40 (landscape) with orientation 6, so it is displayed 40×120 (portrait).
    const jpeg = Uint8Array.from(
      await sharp({ create: { width: 120, height: 40, channels: 3, background: '#cc2200' } })
        .jpeg()
        .withMetadata({ orientation: 6 })
        .toBuffer(),
    );
    const workspace = await withLogo(jpeg, 'logo.jpg');
    await generateWebIcons(workspace, { background: '#ffffff' });
    // In the 180 px touch icon the 140 px logo box holds a portrait logo: red at the top centre, white at the far left.
    const touch = sharp(path.join(folder(workspace), 'apple-touch-icon.png'));
    const pixel = async (left: number, top: number) =>
      [...(await touch.clone().extract({ left, top, width: 1, height: 1 }).raw().toBuffer())];
    expect(await pixel(90, 30)).toEqual([0xcc, 0x22, 0x00]);
    expect(await pixel(30, 90)).toEqual([0xff, 0xff, 0xff]);
  });

  test('asks for a logo when none was uploaded', async () => {
    const workspace = await workspaceFactory();
    await expect(generateWebIcons(workspace)).rejects.toThrow(new GeneratorError('Upload a logo first'));
  });
});
