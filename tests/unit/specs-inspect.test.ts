// conventions: RULE-TESTING-3301
import { mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { inspectImage } from '../../src/core/specs/index.js';

const dir = mkdtempSync(path.join(tmpdir(), 'amc-inspect-'));

describe('inspectImage measures an image file', () => {
  test('measures a 64×32 PNG with an alpha channel', async () => {
    const file = path.join(dir, 'alpha.png');
    await sharp({ create: { width: 64, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } } })
      .png()
      .toFile(file);
    expect(await inspectImage(file)).toEqual({
      width: 64,
      height: 32,
      format: 'png',
      hasAlpha: true,
      bytes: statSync(file).size,
    });
  });

  test('reports a JPEG as having no alpha channel', async () => {
    const file = path.join(dir, 'photo.jpg');
    await sharp({ create: { width: 10, height: 20, channels: 3, background: '#336699' } }).jpeg().toFile(file);
    expect(await inspectImage(file)).toMatchObject({ format: 'jpeg', hasAlpha: false, width: 10, height: 20 });
  });

  test('reports the displayed orientation of a JPEG rotated by EXIF', async () => {
    const file = path.join(dir, 'rotated.jpg');
    await sharp({ create: { width: 40, height: 20, channels: 3, background: '#000000' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toFile(file);
    expect(await inspectImage(file)).toMatchObject({ width: 20, height: 40 });
  });

  test('rejects a text file as not a supported image', async () => {
    const file = path.join(dir, 'notes.txt');
    writeFileSync(file, 'not an image');
    await expect(inspectImage(file)).rejects.toThrow('is not a supported image');
  });

  test('rejects a missing file', async () => {
    await expect(inspectImage(path.join(dir, 'missing.png'))).rejects.toThrow();
  });
});
