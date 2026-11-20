// conventions: RULE-TESTING-3301
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist, readManifest } from '../../src/core/export/index.js';
import { generateExpoIcons } from '../../src/core/generators/expo-icons.js';
import { generateLogoPack, packOf } from '../../src/core/generators/logo-packs.js';
import { getSpec, inspectImage, validateMedia } from '../../src/core/specs/index.js';
import { defaultLogoSettings, saveInput, saveProject, validateLogoSettings, type Workspace } from '../../src/core/workspace/index.js';
import { twoColourPng } from '../factories/logos.js';
import { projectInputFactory, svgBytes, workspaceFactory } from '../factories/workspace.js';

/** A workspace with the logo and the given stores on. */
async function expoWorkspace(stores: { apple: boolean; google: boolean } = { apple: true, google: true }, logo: Uint8Array = svgBytes()): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const input = projectInputFactory() as { targets: Record<'apple' | 'google', { enabled: boolean }> };
  input.targets.apple.enabled = stores.apple;
  input.targets.google.enabled = stores.google;
  const saved = await saveProject(workspace, input);
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: logo });
  return workspace;
}

const json = (workspace: Workspace, relative: string) => JSON.parse(readFileSync(path.join(workspace.outputDir, relative), 'utf8')) as Record<string, unknown>;

describe('generateExpoIcons writes the icons an Expo project configures in app.json', () => {
  test('writes valid iOS and Android files with their app.json fragments in one expo folder per store', async () => {
    const workspace = await expoWorkspace();
    const entries = await generateExpoIcons(workspace, { background: '#0079dd' });
    expect(entries.map((e) => e.path).sort()).toEqual([
      'apple/shared/expo/app.ios.json',
      'apple/shared/expo/icon-dark.png',
      'apple/shared/expo/icon-tinted.png',
      'apple/shared/expo/icon.png',
      'google/shared/expo/adaptive-foreground.png',
      'google/shared/expo/adaptive-monochrome.png',
      'google/shared/expo/android-icon.png',
      'google/shared/expo/app.android.json',
    ]);
    for (const entry of entries.filter((e) => e.path.endsWith('.png'))) {
      expect(validateMedia(getSpec(entry.specId), await inspectImage(path.join(workspace.outputDir, entry.path))), entry.path).toEqual([]);
    }
    expect(json(workspace, 'apple/shared/expo/app.ios.json')).toEqual({
      expo: { ios: { icon: { light: './assets/expo/icon.png', dark: './assets/expo/icon-dark.png', tinted: './assets/expo/icon-tinted.png' } } },
    });
    expect(json(workspace, 'google/shared/expo/app.android.json')).toEqual({
      expo: {
        android: {
          icon: './assets/expo/android-icon.png',
          adaptiveIcon: { foregroundImage: './assets/expo/adaptive-foreground.png', monochromeImage: './assets/expo/adaptive-monochrome.png', backgroundColor: '#0079dd' },
        },
      },
    });
    const apple = (await exportChecklist(workspace)).targets.find((t) => t.target === 'apple');
    expect(apple?.items.find((i) => i.specId === 'apple.expo.icon')?.status).toBe('ok');
  });

  test('keeps the iOS icon opaque and the adaptive foreground transparent around the logo', async () => {
    const workspace = await expoWorkspace({ apple: true, google: true }, await twoColourPng());
    await generateExpoIcons(workspace);
    const icon = await sharp(path.join(workspace.outputDir, 'apple/shared/expo/icon.png')).metadata();
    expect(icon.hasAlpha).toBe(false);
    const corner = await sharp(path.join(workspace.outputDir, 'google/shared/expo/adaptive-foreground.png')).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
    expect(corner[3]).toBe(0);
  });

  test('writes only the files of the stores that are on, removes those of a store turned off, and refuses a project without app stores', async () => {
    const apple = await expoWorkspace({ apple: true, google: false });
    expect((await generateExpoIcons(apple)).every((e) => e.path.startsWith('apple/'))).toBe(true);
    // Turn Google Play on and the App Store off: the next run leaves no iOS file behind.
    const input = projectInputFactory() as { targets: Record<'apple' | 'google', { enabled: boolean }> };
    input.targets.apple.enabled = false;
    await saveProject(apple, input);
    await generateExpoIcons(apple);
    expect((await readManifest(apple)).entries.filter((e) => e.specId.includes('.expo.')).every((e) => e.path.startsWith('google/'))).toBe(true);
    expect(existsSync(path.join(apple.outputDir, 'apple/shared/expo/icon.png'))).toBe(false);
    await expect(generateExpoIcons(await expoWorkspace({ apple: false, google: false }))).rejects.toThrow('Turn on the App Store or Google Play in Project to make Expo icons');
    await expect(generateExpoIcons(apple, { background: 'blue' as never })).rejects.toThrow('background must be a colour like #1a2b3c');
  });
});

describe('Expo icons are a logo pack of their own', () => {
  test('is its own pack, not chosen by default, and generated with the saved background', async () => {
    expect(packOf('apple.expo.icon')).toBe('expo');
    expect(packOf('google.expo.config')).toBe('expo');
    expect(packOf('apple.icon')).toBe('app-store');
    expect(defaultLogoSettings().packs).not.toContain('expo');
    expect(validateLogoSettings({ ...defaultLogoSettings(), packs: ['expo'] }).ok).toBe(true);
    const workspace = await expoWorkspace({ apple: false, google: true });
    const result = await generateLogoPack(workspace, 'expo');
    expect(result.entries.map((e) => e.specId).sort()).toEqual(['google.expo.adaptive-foreground', 'google.expo.adaptive-monochrome', 'google.expo.config', 'google.expo.icon']);
  });
});
