// conventions: RULE-TESTING-3301
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { exportChecklist } from '../../src/core/export/index.js';
import { generateShareImages } from '../../src/core/generators/share-images.js';
import { getSpec, inspectImageBytes, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { twoColourPng } from '../factories/logos.js';
import { shareTaglines } from '../factories/screenshots.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const TAGLINES = shareTaglines();

async function workspaceWithLogo(): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, { ...projectInputFactory(), name: 'Team Kader', sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] });
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'logo', originalName: 'logo.png', bytes: await twoColourPng() });
  return workspace;
}

const read = (workspace: Workspace, file: string) => readFileSync(path.join(workspace.outputDir, file));

/** Width in px of the white text (the app name) right of the logo: columns with near-white pixels. */
async function textInkWidth(png: Buffer): Promise<number> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let first = -1;
  let last = -1;
  for (let x = Math.round(info.width * 0.3); x < info.width; x++) {
    for (let y = 0; y < info.height; y++) {
      const i = (y * info.width + x) * 3;
      if (data[i]! > 230 && data[i + 1]! > 230 && data[i + 2]! > 230) {
        if (first < 0) first = x;
        last = x;
        break;
      }
    }
  }
  return first < 0 ? 0 : last - first + 1;
}

describe('generateShareImages writes share images per locale', () => {
  test('writes Open Graph, X card and WhatsApp preview for de-DE and tr-TR, each valid for its spec', async () => {
    const workspace = await workspaceWithLogo();
    const { entries, warnings } = await generateShareImages(workspace, { taglines: TAGLINES });
    for (const locale of ['de-DE', 'tr-TR']) {
      for (const [specId, file] of [
        ['web.og-image', `web/${locale}/og-image/01-og-image.png`],
        ['web.x-card', `web/${locale}/x-card/01-x-card.png`],
        ['web.whatsapp-preview', `web/${locale}/whatsapp-preview/01-whatsapp-preview.jpg`],
      ] as const) {
        expect(entries.map((e) => e.path)).toContain(file);
        expect(validateMedia(getSpec(specId), await inspectImageBytes(read(workspace, file)))).toEqual([]);
      }
    }
    expect(warnings.filter((w) => w.code === 'missing-glyphs')).toEqual([]);
    // For a visual check.
    mkdirSync('test-results/share', { recursive: true });
    writeFileSync('test-results/share/og-tr-TR.png', read(workspace, 'web/tr-TR/og-image/01-og-image.png'));
  }, 60_000);

  test('draws the tagline of each locale, so the share images differ per locale', async () => {
    const workspace = await workspaceWithLogo();
    await generateShareImages(workspace, { taglines: TAGLINES });
    expect(read(workspace, 'web/de-DE/og-image/01-og-image.png').equals(read(workspace, 'web/tr-TR/og-image/01-og-image.png'))).toBe(false);
  }, 60_000);

  test('keeps the WhatsApp preview under 300 KB', async () => {
    const workspace = await workspaceWithLogo();
    await generateShareImages(workspace, { locales: 'de-DE' });
    expect(read(workspace, 'web/de-DE/whatsapp-preview/01-whatsapp-preview.jpg').length).toBeLessThanOrEqual(300 * 1024);
  }, 60_000);

  test('draws the whole app name without a tagline and on wide banners (#62)', async () => {
    const workspace = await workspaceFactory();
    const saved = await saveProject(workspace, { ...projectInputFactory(), name: 'Demo', sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] });
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await saveInput(workspace, 'de-DE', { kind: 'logo', originalName: 'logo.png', bytes: await twoColourPng() });
    await generateShareImages(workspace, { background: '#003a72' });
    for (const file of ['web/tr-TR/x-card/01-x-card.png', 'web/de-DE/og-image/01-og-image.png', 'web/shared/social-facebook-cover/facebook-cover.png', 'web/shared/social-linkedin-banner/linkedin-banner.png']) {
      expect(await textInkWidth(read(workspace, file)), file).toBeGreaterThan(150);
    }
  }, 60_000);

  test('rejects a tagline for an unsupported locale and an invalid background', async () => {
    const workspace = await workspaceWithLogo();
    await expect(generateShareImages(workspace, { taglines: { 'pt-BR': 'Olá' } })).rejects.toThrow(/pt-BR is not a supported locale/);
    await expect(generateShareImages(workspace, { background: 'red' as `#${string}` })).rejects.toThrow(/background must be a colour/);
    await expect(generateShareImages(workspace, { taglines: { 'fr-FR': 'Bonjour' } })).rejects.toThrow(/fr-FR is not a language of this project/);
  });
});

describe('Profile pictures, banners, signature and logo variants are shared by all locales', () => {
  test('writes every social size and the logo variants, each valid for its spec', async () => {
    const workspace = await workspaceWithLogo();
    const { entries } = await generateShareImages(workspace, { locales: 'de-DE' });
    const shared = entries.filter((e) => e.locale === undefined);
    expect(shared.map((e) => e.specId).sort()).toEqual(
      expect.arrayContaining(['web.social.instagram-profile', 'web.social.youtube-banner', 'web.social.email-signature-logo', 'web.logo.monochrome', 'web.logo.inverse', 'web.logo.mark']),
    );
    for (const entry of shared) {
      expect(validateMedia(getSpec(entry.specId), await inspectImageBytes(read(workspace, entry.path))), entry.path).toEqual([]);
    }
  }, 60_000);

  test('draws the monochrome variant in one colour and the inverse in white', async () => {
    const workspace = await workspaceWithLogo();
    const { entries } = await generateShareImages(workspace, { locales: 'de-DE' });
    for (const [variant, rgb] of [['web.logo.monochrome', [0, 0, 0]], ['web.logo.inverse', [255, 255, 255]]] as const) {
      const file = entries.find((e) => e.specId === variant)!.path;
      const { data, info } = await sharp(read(workspace, file)).raw().toBuffer({ resolveWithObject: true });
      const colours = new Set<string>();
      for (let i = 0; i < data.length; i += info.channels) if (data[i + 3]! > 200) colours.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      expect([...colours]).toEqual([rgb.join(',')]);
    }
  }, 60_000);

  test('flags the unverified social sizes in the export checklist', async () => {
    const workspace = await workspaceWithLogo();
    await generateShareImages(workspace, { locales: 'de-DE' });
    const checklist = await exportChecklist(workspace, { locales: ['de-DE'] });
    const banner = checklist.targets.find((t) => t.target === 'web')!.items.find((i) => i.specId === 'web.social.youtube-banner');
    expect(banner?.status).toBe('warning');
    expect(banner?.messages.map((m) => m.text)).toContain('Size and limits come from third-party sources, not from the store itself');
  }, 60_000);
});

describe('The generate API builds the share images', () => {
  test('answers 201 with the files and 400 without a logo', async () => {
    const workspace = await workspaceWithLogo();
    const post = (target: Workspace) =>
      createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace: target }).request('/api/generate/share-images', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locales: 'tr-TR', taglines: { 'tr-TR': TAGLINES['tr-TR'] } }),
      });
    expect((await post(workspace)).status).toBe(201);
    expect((await post(await workspaceFactory())).status).toBe(400);
  }, 60_000);
});
