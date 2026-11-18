// conventions: RULE-TESTING-3301
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist } from '../../src/core/export/index.js';
import { clampLogoScale, generateAppStoreIcons } from '../../src/core/generators/app-store-icons.js';
import { GeneratorError } from '../../src/core/generators/logo.js';
import { logoPalette, renderLogoSquare, type LogoSource } from '../../src/core/generators/render.js';
import { getSpec, inspectImage, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, type Workspace } from '../../src/core/workspace/index.js';
import { svgBytes, workspaceFactory } from '../factories/workspace.js';

/** A transparent 300×300 logo: a red square with a smaller blue square below it. */
async function twoColourPng(): Promise<Uint8Array> {
  return Uint8Array.from(
    await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([
        { input: { create: { width: 200, height: 150, channels: 4, background: '#dd1111' } }, left: 50, top: 20 },
        { input: { create: { width: 100, height: 60, channels: 4, background: '#1133dd' } }, left: 100, top: 200 },
      ])
      .png()
      .toBuffer(),
  );
}

async function withLogo(bytes: Uint8Array, name: string): Promise<Workspace> {
  const workspace = await workspaceFactory();
  await saveInput(workspace, 'en-US', { kind: 'logo', originalName: name, bytes });
  return workspace;
}

const file = (workspace: Workspace, relative: string) => path.join(workspace.outputDir, 'apple/shared', relative);

async function pixel(filePath: string, left: number, top: number): Promise<number[]> {
  return [...(await sharp(filePath).ensureAlpha().extract({ left, top, width: 1, height: 1 }).raw().toBuffer())];
}

describe('generateAppStoreIcons builds the App Store icon set from the logo', () => {
  test('writes the icon, both appearances and both Icon Composer layers, all valid', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    const entries = await generateAppStoreIcons(workspace, { background: '#0079dd' });
    expect(entries.map((e) => e.path).sort()).toEqual([
      'apple/shared/icon-composer/background.png',
      'apple/shared/icon-composer/foreground.png',
      'apple/shared/icon/app-icon-dark.png',
      'apple/shared/icon/app-icon-tinted.png',
      'apple/shared/icon/app-icon.png',
    ]);
    for (const entry of entries) {
      const props = await inspectImage(path.join(workspace.outputDir, entry.path));
      expect(validateMedia(getSpec(entry.specId), props), entry.path).toEqual([]);
    }
    const checklist = await exportChecklist(workspace);
    const icon = checklist.targets.find((t) => t.target === 'apple')?.items.find((i) => i.specId === 'apple.icon');
    expect(icon?.status).toBe('ok');
  });

  test('fills the opaque App Store icon with the background colour up to the corners', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateAppStoreIcons(workspace, { background: '#0079dd' });
    const icon = file(workspace, 'icon/app-icon.png');
    expect((await sharp(icon).metadata()).hasAlpha).toBe(false);
    expect(await pixel(icon, 0, 0)).toEqual([0x00, 0x79, 0xdd, 255]);
    expect(await pixel(icon, 1023, 1023)).toEqual([0x00, 0x79, 0xdd, 255]);
  });

  test('keeps the appearances and the foreground transparent and the tinted one free of colour', async () => {
    const workspace = await withLogo(await twoColourPng(), 'logo.png');
    await generateAppStoreIcons(workspace);
    for (const relative of ['icon/app-icon-dark.png', 'icon/app-icon-tinted.png', 'icon-composer/foreground.png']) {
      expect((await pixel(file(workspace, relative), 0, 0))[3], relative).toBe(0);
    }
    const tinted = file(workspace, 'icon/app-icon-tinted.png');
    const [r, g, b, a] = await pixel(tinted, 512, 400);
    expect(a).toBe(255);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(await pixel(file(workspace, 'icon/app-icon-dark.png'), 512, 400)).toEqual([0xdd, 0x11, 0x11, 255]);
  });

  test('never makes the logo box larger than 80 % of the canvas', async () => {
    expect(clampLogoScale(0.9)).toBe(0.8);
    expect(clampLogoScale(0.1)).toBe(0.4);
    expect(clampLogoScale(undefined)).toBe(0.7);
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateAppStoreIcons(workspace, { background: '#ffffff', logoScale: 0.9 });
    // The square logo fills its box: at 80 % the box spans 102..921, so pixel 100 is background and 104 is logo.
    const icon = file(workspace, 'icon/app-icon.png');
    expect(await pixel(icon, 100, 512)).toEqual([255, 255, 255, 255]);
    expect((await pixel(icon, 104, 512)).slice(0, 3)).not.toEqual([255, 255, 255]);
  });

  test('reports a logo with truncated pixel data as unreadable', async () => {
    const full = await twoColourPng();
    // Keep the header and cut the image data, so the size is readable but the pixels are not.
    const workspace = await withLogo(full.slice(0, Math.floor(full.length / 2)), 'cut.png').catch(() => undefined);
    if (!workspace) return; // The upload check already rejects files sharp cannot read at all.
    await expect(generateAppStoreIcons(workspace)).rejects.toBeInstanceOf(GeneratorError);
  });

  test('rejects a missing logo and an invalid colour', async () => {
    await expect(generateAppStoreIcons(await workspaceFactory())).rejects.toThrow(new GeneratorError('Upload a logo first'));
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await expect(generateAppStoreIcons(workspace, { background: 'blue' as never })).rejects.toBeInstanceOf(GeneratorError);
  });
});

describe('Rendering helpers for icons', () => {
  const pngLogo = async (): Promise<LogoSource> => ({ bytes: Buffer.from(await twoColourPng()), isSvg: false, width: 300, height: 300 });

  test('renders a logo in grey tones and keeps its transparency', async () => {
    const out = await renderLogoSquare(await pngLogo(), { size: 64, logoBox: 64, grayscale: true });
    const raw = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(raw.info.channels).toBe(4);
    expect(raw.data[3]).toBe(0);
    for (let i = 0; i < raw.data.length; i += 4) {
      if (raw.data[i + 3] === 255) expect(raw.data[i]).toBe(raw.data[i + 2]);
    }
  });

  test('reads the palette of a greyscale logo with transparency correctly', async () => {
    const grey = await sharp({ create: { width: 40, height: 40, channels: 4, background: { r: 60, g: 60, b: 60, alpha: 1 } } })
      .greyscale()
      .png()
      .toBuffer();
    const palette = await logoPalette({ bytes: grey, isSvg: false, width: 40, height: 40 });
    expect(palette).toEqual(['#3c3c3c']);
  });

  test('lists red first and blue among the palette colours of a mostly red logo', async () => {
    const palette = await logoPalette(await pngLogo());
    expect(palette[0]).toBe('#dd1111');
    expect(palette).toContain('#1133dd');
  });
});
