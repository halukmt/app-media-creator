// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { createExport, exportChecklist, outputPath, readManifest } from '../../src/core/export/index.js';
import { generateAndroidIcons } from '../../src/core/generators/android-icons.js';
import { generateAppStoreIcons } from '../../src/core/generators/app-store-icons.js';
import { blueprintBackground } from '../../src/core/generators/environments.js';
import { generateWebIcons } from '../../src/core/generators/web-icons.js';
import { getSpec, inspectImage, validateMedia } from '../../src/core/specs/index.js';
import { saveInput, saveProject, validateProject, type Environment, type Workspace } from '../../src/core/workspace/index.js';
import { flatPng, transparentSvg } from '../factories/logos.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const PREVIEW: Environment = { id: 'preview', badge: 'PREVIEW', color: 'orange', style: 'badge' };
const DEV: Environment = { id: 'dev', badge: 'DEV', color: 'purple', style: 'blueprint' };

async function workspaceWith(logo: { name: string; bytes: Uint8Array }, environments: Environment[]): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ environments }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'en-US', { kind: 'logo', originalName: logo.name, bytes: logo.bytes });
  return workspace;
}

const LOGOS = [
  { label: 'a transparent SVG logo', logo: () => ({ name: 'logo.svg', bytes: transparentSvg() }) },
  { label: 'a flat PNG logo', logo: async () => ({ name: 'logo.png', bytes: await flatPng() }) },
];

const read = (workspace: Workspace, file: string) => readFileSync(path.join(workspace.outputDir, file));

describe('Project settings list non-production environments', () => {
  test('defaults to one preview environment, also for project files without the field', () => {
    const { environments: _drop, ...older } = projectInputFactory();
    const result = validateProject(older);
    expect(result.ok && result.project.environments).toEqual([PREVIEW]);
  });

  test('normalises id and badge and rejects reserved or duplicate ids and long badges', () => {
    const ok = validateProject(projectInputFactory({ environments: [{ id: ' Beta ', badge: 'beta', color: 'green', style: 'badge' }] }));
    expect(ok.ok && ok.project.environments).toEqual([{ id: 'beta', badge: 'BETA', color: 'green', style: 'badge' }]);
    const bad = validateProject(
      projectInputFactory({
        environments: [
          { id: 'production', badge: 'PROD', color: 'orange', style: 'badge' },
          { id: 'dev', badge: 'DEVELOPMENT1', color: 'pink', style: 'badge' },
          { id: 'dev', badge: 'DEV', color: 'red', style: 'neon' },
        ],
      }),
    );
    expect(bad.ok).toBe(false);
    const errors = bad.ok ? [] : bad.errors.join('\n');
    expect(errors).toMatch(/environments\.0\.id/);
    expect(errors).toMatch(/environments\.1\.badge/);
    expect(errors).toMatch(/environments\.1\.color/);
    expect(errors).toMatch(/environments\.2\.style/);
  });

  test('puts environment files next to the shared ones and never into a localized set', () => {
    expect(outputPath(getSpec('apple.icon'), { environment: 'preview', order: 1, name: 'app-icon', extension: 'png' })).toBe('apple/preview/icon/app-icon.png');
    expect(() => outputPath(getSpec('apple.icon'), { environment: 'shared', order: 1, name: 'x', extension: 'png' })).toThrow(/Invalid environment/);
    expect(() =>
      outputPath(getSpec('web.og-image'), { environment: 'preview', locale: 'de-DE', order: 1, name: 'og', extension: 'png' }),
    ).toThrow(/has no environment variants/);
  });
});

describe.each(LOGOS)('Icon variants from $label', ({ logo }) => {
  test('keep the production App Store set unchanged and add a valid set per environment', async () => {
    const plain = await workspaceWith(await logo(), []);
    const withVariants = await workspaceWith(await logo(), [PREVIEW, DEV]);
    const production = await generateAppStoreIcons(plain, { background: '#0079dd' });
    const all = await generateAppStoreIcons(withVariants, { background: '#0079dd' });

    for (const entry of production) expect(read(withVariants, entry.path).equals(read(plain, entry.path)), entry.path).toBe(true);
    for (const environment of ['preview', 'dev']) {
      const set = all.filter((e) => e.environment === environment);
      expect(set.map((e) => e.path).sort()).toEqual(
        ['icon/app-icon.png', 'icon/app-icon-dark.png', 'icon/app-icon-tinted.png', 'icon-composer/background.png', 'icon-composer/foreground.png']
          .map((f) => `apple/${environment}/${f}`)
          .sort(),
      );
      for (const entry of set) {
        expect(validateMedia(getSpec(entry.specId), await inspectImage(path.join(withVariants.outputDir, entry.path))), entry.path).toEqual([]);
      }
    }
    // The variants differ from production and from each other.
    const icon = (dir: string) => read(withVariants, `apple/${dir}/icon/app-icon.png`);
    expect(icon('preview').equals(icon('shared'))).toBe(false);
    expect(icon('dev').equals(icon('preview'))).toBe(false);
  }, 60_000);

  test('write Android launcher resources and a favicon set per environment, valid for their specs', async () => {
    const workspace = await workspaceWith(await logo(), [PREVIEW, DEV]);
    const android = await generateAndroidIcons(workspace);
    const web = await generateWebIcons(workspace);
    for (const environment of ['preview', 'dev']) {
      const androidSet = android.filter((e) => e.environment === environment);
      // 4 files per density (5 densities) and ic_launcher.xml; the Play icon has no variants.
      expect(androidSet).toHaveLength(5 * 4 + 1);
      expect(androidSet.every((e) => e.path.startsWith(`google/${environment}/android-res/`))).toBe(true);
      const webSet = web.filter((e) => e.environment === environment);
      expect(webSet.map((e) => path.posix.basename(e.path)).sort()).toContain('favicon.ico');
      expect(webSet.every((e) => e.path.startsWith(`web/${environment}/favicons/`))).toBe(true);
      expect(JSON.parse(read(workspace, `web/${environment}/favicons/site.webmanifest`).toString()).name).toMatch(environment === 'dev' ? /\(DEV\)$/ : /\(PREVIEW\)$/);
    }
    const checklist = await exportChecklist(workspace);
    const items = checklist.targets.flatMap((t) => t.items).filter((i) => i.environment !== undefined);
    expect(new Set(items.map((i) => i.environment))).toEqual(new Set(['preview', 'dev']));
    expect(items.filter((i) => i.status === 'error')).toEqual([]);
  }, 90_000);
});

describe('The two styles look different', () => {
  test('badge keeps the production background and draws the label in the environment colour', async () => {
    const workspace = await workspaceWith({ name: 'logo.svg', bytes: transparentSvg() }, [PREVIEW]);
    await generateAppStoreIcons(workspace, { background: '#ffffff' });
    const { data, info } = await sharp(read(workspace, 'apple/preview/icon/app-icon.png')).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
    expect(at(10, 10)).toEqual([255, 255, 255]);
    // The label pill sits at the bottom centre; its left end is the environment colour (#c2410c).
    const row = Math.round(1024 * (0.5 + 0.62 * 0.46));
    const colours = new Set<string>();
    for (let x = 300; x < 724; x += 4) colours.add(at(x, row).join(','));
    expect([...colours]).toContain('194,65,12');
  }, 30_000);

  test('blueprint draws a blue background with grid lines and no alpha channel', async () => {
    const workspace = await workspaceWith({ name: 'logo.png', bytes: await flatPng() }, [DEV]);
    await generateAppStoreIcons(workspace);
    const icon = read(workspace, 'apple/dev/icon/app-icon.png');
    expect((await sharp(icon).metadata()).hasAlpha).toBe(false);
    const { dominant } = await sharp(icon).stats();
    expect(dominant.b).toBeGreaterThan(dominant.r + 60);
    const background = await sharp(await blueprintBackground(256)).raw().toBuffer();
    // A grid line (x = 64, a major line) is lighter than the cell next to it.
    const pixel = (x: number, y: number) => background[(y * 256 + x) * 3]!;
    expect(pixel(64, 30)).toBeGreaterThan(pixel(70, 30));
  }, 30_000);
});

describe('Environment ids that would share a folder with something else', () => {
  test('rejects a language code in lower case, which is the locale folder on Windows and macOS', () => {
    const result = validateProject(projectInputFactory({ environments: [{ id: 'de-de', badge: 'DE', color: 'red', style: 'badge' }] }));
    expect(result.ok).toBe(false);
    expect(result.ok ? '' : result.errors.join('\n')).toMatch(/environments\.0\.id: .*language code/);
  });
});

describe('Removing an environment', () => {
  test('warns in the checklist and leaves its files out of the ZIP until the icons are generated again', async () => {
    const workspace = await workspaceWith({ name: 'logo.svg', bytes: transparentSvg() }, [PREVIEW, DEV]);
    await generateAppStoreIcons(workspace);
    expect((await saveProject(workspace, projectInputFactory({ environments: [PREVIEW] }))).ok).toBe(true);

    const checklist = await exportChecklist(workspace);
    const dev = checklist.targets.flatMap((t) => t.items).find((i) => i.specId === 'apple.icon' && i.environment === 'dev');
    expect(dev?.status).toBe('warning');
    expect(dev?.messages[0]?.text).toMatch(/no longer an environment of the project/);
    const { entries } = await createExport(workspace);
    expect(entries).toContain('apple/preview/icon/app-icon.png');
    expect(entries.some((e) => e.startsWith('apple/dev/'))).toBe(false);
  }, 60_000);

  test('reports a configured environment without files once the asset has variants', async () => {
    const workspace = await workspaceWith({ name: 'logo.svg', bytes: transparentSvg() }, [PREVIEW]);
    await generateAppStoreIcons(workspace);
    expect((await saveProject(workspace, projectInputFactory({ environments: [PREVIEW, DEV] }))).ok).toBe(true);
    const items = (await exportChecklist(workspace)).targets.flatMap((t) => t.items).filter((i) => i.specId === 'apple.icon');
    expect(items.map((i) => i.environment)).toEqual([undefined, 'preview', 'dev']);
    expect(items[2]?.messages.map((m) => m.text).join(' ')).toMatch(/not been generated yet for dev/);
  }, 60_000);

  test('removes its files on the next generation and keeps the remaining environment', async () => {
    const workspace = await workspaceWith({ name: 'logo.svg', bytes: transparentSvg() }, [PREVIEW, DEV]);
    await generateAppStoreIcons(workspace);
    const saved = await saveProject(workspace, projectInputFactory({ environments: [PREVIEW] }));
    expect(saved.ok).toBe(true);
    await generateAppStoreIcons(workspace);
    const manifest = await readManifest(workspace);
    expect(manifest.entries.some((e) => e.environment === 'dev')).toBe(false);
    expect(manifest.entries.some((e) => e.environment === 'preview')).toBe(true);
  }, 60_000);
});
