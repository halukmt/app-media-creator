import path from 'node:path';
import { readManifest, locateOutputFile, type OutputEntry } from '../export/manifest.js';
import type { LocaleSelection } from '../locales/index.js';
import type { CardWarning } from '../screenshots/index.js';
import { getSpec, inspectImage } from '../specs/index.js';
import { LOGO_PACKS, readLogoSettings, type LogoPack, type Workspace } from '../workspace/index.js';
import { generateAndroidIcons } from './android-icons.js';
import { generateAppStoreIcons } from './app-store-icons.js';
import { GeneratorError } from './logo.js';
import { generateShareImages } from './share-images.js';
import { generateWebIcons } from './web-icons.js';

export interface PackResult {
  entries: OutputEntry[];
  warnings: (CardWarning & { path: string })[];
}

/** The logo pack an output belongs to, from its catalogue entry; null for outputs of other sections. */
export function packOf(specId: string): LogoPack | null {
  const spec = getSpec(specId);
  if (spec.target === 'apple' && spec.group === 'icon') return 'app-store';
  if (spec.target === 'google' && spec.group === 'icon') return 'google-play';
  if (spec.target === 'web' && spec.group === 'favicon') return 'web';
  if (spec.target === 'web' && (spec.group === 'share' || spec.group === 'social' || spec.group === 'logo')) return 'social';
  return null;
}

/**
 * Generates one logo pack with the saved Logo settings (background, taglines), so the UI, the CLI and skills all give
 * the same result from one source. `locales` limits the share images; icons are shared by all locales.
 */
export async function generateLogoPack(workspace: Workspace, pack: string, options: { locales?: LocaleSelection } = {}): Promise<PackResult> {
  if (!(LOGO_PACKS as readonly string[]).includes(pack)) throw new GeneratorError(`Unknown pack: ${pack}`);
  const settings = await readLogoSettings(workspace);
  switch (pack as LogoPack) {
    case 'app-store':
      return { entries: await generateAppStoreIcons(workspace, { background: settings.background }), warnings: [] };
    case 'google-play':
      return { entries: await generateAndroidIcons(workspace, { background: settings.background }), warnings: [] };
    case 'web':
      return { entries: await generateWebIcons(workspace, { background: settings.background }), warnings: [] };
    case 'social':
      return generateShareImages(workspace, {
        background: settings.background,
        taglines: settings.taglines,
        ...(options.locales !== undefined ? { locales: options.locales } : {}),
      });
  }
}

export interface LogoOutput {
  path: string;
  specId: string;
  /** Catalogue name of the asset. */
  name: string;
  locale?: string;
  pack: LogoPack;
  /** Measured pixel size; absent for documents (manifest, HTML, ICO, SVG). */
  width?: number;
  height?: number;
}

const RASTER = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/** The generated files of the logo packs, with pack and measured size, for the preview grid. */
export async function listLogoOutputs(workspace: Workspace): Promise<LogoOutput[]> {
  const outputs: LogoOutput[] = [];
  for (const entry of (await readManifest(workspace)).entries) {
    const pack = packOf(entry.specId);
    if (!pack) continue;
    const output: LogoOutput = {
      path: entry.path,
      specId: entry.specId,
      name: getSpec(entry.specId).name,
      ...(entry.locale ? { locale: entry.locale } : {}),
      pack,
    };
    const file = path.join(workspace.outputDir, entry.path);
    if (RASTER.has(path.extname(entry.path).toLowerCase()) && (await locateOutputFile(file, workspace.outputDir)) === 'own') {
      try {
        const { width, height } = await inspectImage(file);
        Object.assign(output, { width, height });
      } catch {
        // An unreadable file stays without size; the export checklist reports it.
      }
    }
    outputs.push(output);
  }
  return outputs;
}
