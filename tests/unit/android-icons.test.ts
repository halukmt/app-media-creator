// conventions: RULE-TESTING-3301
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist, readManifest } from '../../src/core/export/index.js';
import { ADAPTIVE_LOGO_SHARE, generateAndroidIcons } from '../../src/core/generators/android-icons.js';
import { GeneratorError } from '../../src/core/generators/logo.js';
import { loadLogo } from '../../src/core/generators/render.js';
import { getSpec, inspectImage, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, type Workspace } from '../../src/core/workspace/index.js';
import { opaqueJpegLogo, squareSvg, twoColourPng } from '../factories/logos.js';
import { svgBytes, workspaceFactory } from '../factories/workspace.js';

async function withLogo(bytes: Uint8Array, name: string): Promise<Workspace> {
  const workspace = await workspaceFactory();
  await saveInput(workspace, 'en-US', { kind: 'logo', originalName: name, bytes });
  return workspace;
}

const res = (workspace: Workspace, relative: string) => path.join(workspace.outputDir, 'google/shared/android-res', relative);

async function rgba(filePath: string) {
  return sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

describe('generateAndroidIcons builds the Play icon and the launcher resources', () => {
  test('writes the Play icon as an opaque 32-bit 512 PNG with the background in its corners', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateAndroidIcons(workspace, { background: '#0079dd' });
    const file = path.join(workspace.outputDir, 'google/shared/icon/play-icon.png');
    const metadata = await sharp(file).metadata();
    expect([metadata.width, metadata.height, metadata.channels]).toEqual([512, 512, 4]);
    const { data } = await rgba(file);
    expect([...data.subarray(0, 4)]).toEqual([0x00, 0x79, 0xdd, 255]);
    // One assertion over all alpha values; an expect per pixel (262 144 calls) timed out under parallel load.
    let minAlpha = 255;
    for (let i = 3; i < data.length; i += 4) minAlpha = Math.min(minAlpha, data[i] ?? 0);
    expect(minAlpha).toBe(255);
  });

  test('writes every density folder with the sizes of the catalogue and a valid file each', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    const entries = (await generateAndroidIcons(workspace)).filter((e) => e.environment === undefined);
    expect(entries).toHaveLength(1 + 5 * 4 + 1);
    expect((await inspectImage(res(workspace, 'mipmap-xxxhdpi/ic_launcher_foreground.png'))).width).toBe(432);
    expect((await inspectImage(res(workspace, 'mipmap-mdpi/ic_launcher.png'))).width).toBe(48);
    for (const entry of entries.filter((e) => e.path.endsWith('.png'))) {
      const props = await inspectImage(path.join(workspace.outputDir, entry.path));
      expect(validateMedia(getSpec(entry.specId), props), entry.path).toEqual([]);
    }
    const google = (await exportChecklist(workspace)).targets.find((t) => t.target === 'google');
    const errors = google?.items.filter((i) => i.files.length > 0).flatMap((i) => i.messages.filter((m) => m.level === 'error'));
    expect(errors).toEqual([]);
    expect((await readManifest(workspace)).problems).toEqual([]);
  });

  test('keeps every logo pixel of the foreground inside the 66 dp safe circle, even for a square logo', async () => {
    expect(ADAPTIVE_LOGO_SHARE * 108 * Math.SQRT2).toBeCloseTo(66, 5);
    const workspace = await withLogo(squareSvg(512), 'square.svg');
    await generateAndroidIcons(workspace);
    const { data, info } = await rgba(res(workspace, 'mipmap-xxxhdpi/ic_launcher_foreground.png'));
    const radius = (432 * 66) / 108 / 2; // 132 px
    const centre = 432 / 2;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        if (data[(y * info.width + x) * 4 + 3]! > 0) {
          const distance = Math.hypot(x + 0.5 - centre, y + 0.5 - centre);
          expect(distance <= radius, `pixel ${x},${y} at ${distance.toFixed(1)} px`).toBe(true);
        }
      }
    }
  });

  test('draws the monochrome layer as a one-colour silhouette on transparency', async () => {
    const workspace = await withLogo(await twoColourPng(), 'logo.png');
    await generateAndroidIcons(workspace);
    const { data } = await rgba(res(workspace, 'mipmap-xxhdpi/ic_launcher_monochrome.png'));
    expect(data[3]).toBe(0);
    const colours = new Set<string>();
    for (let i = 0; i < data.length; i += 4) if (data[i + 3] === 255) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    expect([...colours]).toEqual(['255,255,255']);
  });

  test('cuts the white background out of an opaque JPEG logo for the monochrome layer', async () => {
    const workspace = await withLogo(await opaqueJpegLogo(), 'logo.jpg');
    await generateAndroidIcons(workspace);
    const { data, info } = await rgba(res(workspace, 'mipmap-xxxhdpi/ic_launcher_monochrome.png'));
    const at = (x: number, y: number) => data[(y * info.width + x) * 4 + 3];
    expect(at(216, 216)).toBe(255); // the red block in the middle
    expect(at(140, 140)).toBe(0); // the white background around it, inside the logo box
  });

  test('writes ic_launcher.xml that references the three layers', async () => {
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await generateAndroidIcons(workspace);
    const xml = readFileSync(res(workspace, 'mipmap-anydpi-v26/ic_launcher.xml'), 'utf8');
    for (const layer of ['background', 'foreground', 'monochrome']) {
      expect(xml).toContain(`<${layer} android:drawable="@mipmap/ic_launcher_${layer}" />`);
    }
  });

  test('asks for a logo when none was uploaded and rejects an invalid colour', async () => {
    await expect(generateAndroidIcons(await workspaceFactory())).rejects.toThrow(new GeneratorError('Upload a logo first'));
    const workspace = await withLogo(svgBytes(), 'logo.svg');
    await expect(generateAndroidIcons(workspace, { background: '#12' as never })).rejects.toBeInstanceOf(GeneratorError);
  });

  test('renders an SVG with a large declared canvas and rejects an absurd one', async () => {
    const large = await withLogo(squareSvg(16000), 'large.svg');
    expect((await generateAndroidIcons(large)).filter((e) => e.environment === undefined)).toHaveLength(22);
    // The upload already refuses an SVG that cannot be read at all; loadLogo also refuses canvases it cannot bound.
    await expect(withLogo(squareSvg(2_000_000), 'absurd.svg')).rejects.toThrow('A logo must be PNG, JPEG, WEBP, SVG');
    const file = path.join((await workspaceFactory()).root, 'wide.svg');
    writeFileSync(file, squareSvg(700_000));
    await expect(loadLogo(file)).rejects.toThrow();
  });
});
