// conventions: RULE-TESTING-3301
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { cleanOutputName, outputPath, readManifest, registerOutput } from '../../src/core/export/index.js';
import { getSpec } from '../../src/core/specs/index.js';
import { pngBytes, workspaceFactory } from '../factories/workspace.js';

describe('outputPath gives every generated file its place in the store layout', () => {
  test('puts the third 6.9-inch iPhone screenshot for tr-TR into apple/tr-TR/iphone-6.9', () => {
    const spec = getSpec('apple.screenshot.iphone-6.9');
    expect(outputPath(spec, { locale: 'tr-TR', order: 3, name: 'Result', extension: 'png' })).toBe(
      'apple/tr-TR/iphone-6.9/03-result.png',
    );
  });

  test('puts the App Store icon into apple/shared/icon without a locale', () => {
    const spec = getSpec('apple.icon');
    expect(outputPath(spec, { order: 1, name: 'app-icon', extension: '.png' })).toBe('apple/shared/icon/app-icon.png');
  });

  test('uses the asset group as folder for localized assets that are not screenshots', () => {
    const spec = getSpec('google.feature-graphic');
    expect(outputPath(spec, { locale: 'de-DE', order: 1, name: 'feature', extension: 'png' })).toBe(
      'google/de-DE/feature-graphic/01-feature.png',
    );
  });

  test('keeps previews apart from screenshots of the same device', () => {
    expect(outputPath(getSpec('apple.preview.iphone-5.5'), { locale: 'de-DE', order: 1, name: 'p', extension: 'mp4' })).toBe(
      'apple/de-DE/preview-iphone-5.5/01-p.mp4',
    );
  });

  test('rejects a localized asset without a locale and a shared asset with one', () => {
    expect(() => outputPath(getSpec('apple.screenshot.iphone-6.3'), { order: 1, name: 'a', extension: 'png' })).toThrow(
      'is localized and needs a locale',
    );
    expect(() => outputPath(getSpec('apple.icon'), { locale: 'de-DE', order: 1, name: 'a', extension: 'png' })).toThrow(
      'is shared and must not have a locale',
    );
  });

  test('rejects an order outside 1 to 99 and an odd extension', () => {
    const spec = getSpec('apple.screenshot.iphone-6.3');
    expect(() => outputPath(spec, { locale: 'de-DE', order: 0, name: 'a', extension: 'png' })).toThrow('between 1 and 99');
    expect(() => outputPath(spec, { locale: 'de-DE', order: 1, name: 'a', extension: '../x' })).toThrow('Invalid file extension');
  });
});

describe('registerOutput writes the file and records it in the manifest', () => {
  test('starts with an empty manifest', async () => {
    const workspace = await workspaceFactory();
    expect(await readManifest(workspace)).toEqual({ version: 1, entries: [], problems: [] });
  });

  test('stores the Play icon and the launcher icon with the same name in different folders', async () => {
    const workspace = await workspaceFactory();
    const bytes = await pngBytes();
    const play = await registerOutput(workspace, { specId: 'google.icon', order: 1, name: 'icon', extension: 'png', bytes });
    const launcher = await registerOutput(workspace, { specId: 'google.launcher-icon', order: 1, name: 'icon', extension: 'png', bytes });
    expect([play.path, launcher.path]).toEqual(['google/shared/icon/icon.png', 'google/shared/launcher-icon/icon.png']);
    expect((await readManifest(workspace)).entries).toHaveLength(2);
  });

  test('replaces set position 03 registered under a new name and removes the old file', async () => {
    const workspace = await workspaceFactory();
    const base = { specId: 'apple.screenshot.iphone-6.3', locale: 'de-DE', order: 3, extension: 'png', bytes: await pngBytes() };
    const old = await registerOutput(workspace, { ...base, name: 'result' });
    await registerOutput(workspace, { ...base, name: 'result-v2' });
    expect((await readManifest(workspace)).entries.map((e) => e.path)).toEqual(['apple/de-DE/iphone-6.3/03-result-v2.png']);
    expect(existsSync(path.join(workspace.outputDir, old.path))).toBe(false);
  });

  test('drops manifest entries whose path leaves the output layout and reports them', async () => {
    const workspace = await workspaceFactory();
    writeFileSync(
      path.join(workspace.outputDir, 'manifest.json'),
      JSON.stringify({
        version: 1,
        entries: [
          { specId: 'apple.icon', order: 1, name: 'a', path: '../../.ssh/id_rsa', fallbackInput: false },
          { specId: 'nope', order: 1, name: 'a', path: 'apple/shared/icon/a.png', fallbackInput: false },
          { specId: 'apple.icon', order: 1, name: 'app-icon', path: 'apple/shared/icon/app-icon.png', fallbackInput: false },
        ],
      }),
    );
    const manifest = await readManifest(workspace);
    expect(manifest.entries.map((e) => e.path)).toEqual(['apple/shared/icon/app-icon.png']);
    expect(manifest.problems).toHaveLength(2);
    expect(manifest.problems[0]).toContain('../../.ssh/id_rsa');
    expect(manifest.problems[1]).toContain('Unknown media asset: nope');
  });

  test('stores the file and the entry', async () => {
    const workspace = await workspaceFactory();
    const entry = await registerOutput(workspace, {
      specId: 'apple.screenshot.iphone-6.3',
      locale: 'de-DE',
      order: 1,
      name: 'Start',
      extension: 'png',
      bytes: await pngBytes(),
      fallbackInput: true,
    });
    expect(entry).toEqual({
      specId: 'apple.screenshot.iphone-6.3',
      locale: 'de-DE',
      order: 1,
      name: 'start',
      path: 'apple/de-DE/iphone-6.3/01-start.png',
      fallbackInput: true,
    });
    expect(existsSync(path.join(workspace.outputDir, entry.path))).toBe(true);
    expect((await readManifest(workspace)).entries).toEqual([entry]);
  });

  test('replaces the entry when the same path is registered again', async () => {
    const workspace = await workspaceFactory();
    const options = { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes() };
    await registerOutput(workspace, options);
    await registerOutput(workspace, { ...options, fallbackInput: true });
    const { entries } = await readManifest(workspace);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.fallbackInput).toBe(true);
  });

  test('keeps every entry when many files are registered at once', async () => {
    const workspace = await workspaceFactory();
    const bytes = await pngBytes();
    await Promise.all(
      [1, 2, 3, 4, 5].map((order) =>
        registerOutput(workspace, { specId: 'apple.screenshot.iphone-6.3', locale: 'de-DE', order, name: 's', extension: 'png', bytes }),
      ),
    );
    expect((await readManifest(workspace)).entries).toHaveLength(5);
  });
});

describe('cleanOutputName keeps generated names stable', () => {
  test('keeps dots inside a name and gives the same result when applied twice', () => {
    expect(cleanOutputName('Home.Dark')).toBe('home.dark');
    expect(cleanOutputName(cleanOutputName('Ekran Görüntüsü.v2'))).toBe('ekran-goruntusu.v2');
  });

  test('drops folders, leading dots and falls back to "file"', () => {
    expect(cleanOutputName('../../secret')).toBe('secret');
    expect(cleanOutputName('...')).toBe('file');
  });
});
