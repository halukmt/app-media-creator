// conventions: RULE-TESTING-3301
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { InputError, detectFormat, listInputs, safeBaseName, saveInput } from '../../src/core/workspace/index.js';
import { isoBytes, mp4Bytes, pngBytes, svgBytes, workspaceFactory } from '../factories/workspace.js';

describe('saveInput stores checked uploads in the workspace', () => {
  test('stores a PNG screenshot under its locale and lists it for that locale', async () => {
    const workspace = await workspaceFactory();
    const stored = await saveInput(workspace, 'en-US', {
      kind: 'screenshot',
      locale: 'tr-TR',
      originalName: 'Ekran Görüntüsü.png',
      bytes: await pngBytes(),
    });
    expect(stored.path).toMatch(/^inputs\/screenshots\/tr-TR\/\d+-[0-9a-f]{6}-ekran-goruntusu\.png$/);
    expect(existsSync(path.join(workspace.root, stored.path))).toBe(true);
    const list = await listInputs(workspace);
    expect(list).toEqual([expect.objectContaining({ kind: 'screenshot', locale: 'tr-TR', format: 'png' })]);
  });

  test('uses the source locale when no locale is given', async () => {
    const workspace = await workspaceFactory();
    const stored = await saveInput(workspace, 'de-DE', { kind: 'video', originalName: 'demo.mp4', bytes: mp4Bytes() });
    expect(stored).toMatchObject({ locale: 'de-DE', format: 'mp4' });
  });

  test('stores an SVG logo once, without a locale folder', async () => {
    const workspace = await workspaceFactory();
    const stored = await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
    expect(stored.path).toMatch(/^inputs\/logo\/\d+-[0-9a-f]{6}-logo\.svg$/);
    expect(stored.locale).toBeUndefined();
  });

  test('rejects a text file with a .png name', async () => {
    const workspace = await workspaceFactory();
    const upload = saveInput(workspace, 'en-US', {
      kind: 'screenshot',
      originalName: 'shot.png',
      bytes: new TextEncoder().encode('just text'),
    });
    await expect(upload).rejects.toThrow('A screenshot must be PNG, JPEG, WEBP');
    await expect(upload).rejects.toBeInstanceOf(InputError);
  });

  test('rejects a logo above 10 MB', async () => {
    const workspace = await workspaceFactory();
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    await expect(saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'big.png', bytes })).rejects.toThrow(
      'exceeds the limit of 10 MB',
    );
  });

  test('rejects an unsupported locale', async () => {
    const workspace = await workspaceFactory();
    const upload = saveInput(workspace, 'en-US', { kind: 'screenshot', locale: 'pt-BR', originalName: 'a.png', bytes: await pngBytes() });
    await expect(upload).rejects.toThrow('pt-BR is not a supported locale');
  });

  test('rejects a locale that tries to leave the inputs folder', async () => {
    const workspace = await workspaceFactory();
    const upload = saveInput(workspace, 'en-US', { kind: 'screenshot', locale: '../../x', originalName: 'a.png', bytes: await pngBytes() });
    await expect(upload).rejects.toThrow('is not a supported locale');
  });

  test('stores a file named ../../outside.png safely inside the workspace', async () => {
    const workspace = await workspaceFactory();
    const stored = await saveInput(workspace, 'en-US', {
      kind: 'screenshot',
      originalName: '../../outside.png',
      bytes: await pngBytes(),
    });
    expect(stored.path).toMatch(/^inputs\/screenshots\/en-US\/\d+-[0-9a-f]{6}-outside\.png$/);
    expect(readdirSync(path.dirname(workspace.root))).toEqual(['.app-media']);
  });

  test('stores two parallel uploads with the same name as two files', async () => {
    const workspace = await workspaceFactory();
    const upload = async () =>
      saveInput(workspace, 'en-US', { kind: 'screenshot', originalName: 'same.png', bytes: await pngBytes() });
    const [first, second] = await Promise.all([upload(), upload()]);
    expect(first.path).not.toBe(second.path);
    expect(await listInputs(workspace)).toHaveLength(2);
  });

  test('ignores OS junk files and other formats when listing inputs', async () => {
    const workspace = await workspaceFactory();
    await saveInput(workspace, 'en-US', { kind: 'screenshot', originalName: 'a.png', bytes: await pngBytes() });
    const folder = path.join(workspace.inputsDir, 'screenshots', 'en-US');
    for (const junk of ['Thumbs.db', 'desktop.ini', '.DS_Store', 'notes.txt']) writeFileSync(path.join(folder, junk), 'x');
    expect((await listInputs(workspace)).map((i) => i.format)).toEqual(['png']);
  });
});

describe('detectFormat recognizes videos by their content', () => {
  test('recognizes MP4, M4V and QuickTime brands', async () => {
    expect(await detectFormat(mp4Bytes())).toBe('mp4');
    expect(await detectFormat(isoBytes('ftyp', 'M4V ', []))).toBe('m4v');
    expect(await detectFormat(isoBytes('ftyp', 'qt  ', []))).toBe('mov');
  });

  test('recognizes a QuickTime file that starts with a moov or wide atom', async () => {
    expect(await detectFormat(isoBytes('moov', 'mvhd', []))).toBe('mov');
    expect(await detectFormat(isoBytes('wide', '\0\0\0\0', []))).toBe('mov');
  });

  test('accepts an unknown major brand only with an MP4 compatible brand', async () => {
    expect(await detectFormat(isoBytes('ftyp', 'XAVC', ['mp42', 'isom']))).toBe('mp4');
  });

  test('does not treat HEIC, AVIF or M4A files as videos', async () => {
    expect(await detectFormat(isoBytes('ftyp', 'heic', ['mif1', 'heic']))).not.toBe('mp4');
    expect(await detectFormat(isoBytes('ftyp', 'avif', ['mif1', 'avif', 'mp42']))).not.toBe('mp4');
    expect(await detectFormat(isoBytes('ftyp', 'M4A ', ['M4A ', 'mp42', 'isom']))).not.toBe('mp4');
  });
});

describe('safeBaseName cleans user file names', () => {
  test('keeps letters, digits, dots, dashes and underscores', () => {
    expect(safeBaseName('My Screen_01.v2.PNG')).toBe('my-screen_01.v2');
  });

  test('strips Windows paths and falls back to "file" for empty names', () => {
    expect(safeBaseName('C:\\Users\\me\\..\\shot.png')).toBe('shot');
    expect(safeBaseName('...png')).toBe('file');
  });
});
