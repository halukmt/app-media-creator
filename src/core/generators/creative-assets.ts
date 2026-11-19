import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { outputPath, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { isLocaleId, resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { cardSizeForSpec, loadUserFrame, renderCreativeAsset, type CreativeInput, type TextWarningCode, type UserFrame } from '../screenshots/index.js';
import { getSpec, type Rect, type SpecEntry } from '../specs/index.js';
import {
  effectiveSet,
  listScreenshots,
  readCreativeSettings,
  readProject,
  readScreenshotSets,
  type CreativeSettings,
  type EffectiveEntry,
  type ProjectSettings,
  type ScreenshotSets,
  type StoredInput,
  type Workspace,
} from '../workspace/index.js';
import { GeneratorError } from './logo.js';
import { assertValidOutputs } from './outputs.js';

/** The App Store creative image specs this generator writes, with the file name of each. */
export const CREATIVE_IMAGES = [
  { specId: 'apple.creative.header-image', name: 'header' },
  { specId: 'apple.creative.search-image', name: 'search' },
  { specId: 'apple.creative.universal-image', name: 'universal' },
] as const;
const CREATIVE_SPEC_IDS: string[] = CREATIVE_IMAGES.map((image) => image.specId);
/** Screenshots one asset uses: the key art plus one per side. */
const SHOTS = 3;

export type CreativeWarningCode = TextWarningCode | 'missing-phrase';

export interface CreativeWarning {
  code: CreativeWarningCode;
  message: string;
  /** Output path of the image, or `apple/<locale>` for a locale-level warning. */
  path: string;
}

export interface CreativeAssetOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
}

export interface CreativeAssetResult {
  entries: OutputEntry[];
  warnings: CreativeWarning[];
  /** Selected languages without screenshots (neither own nor source). */
  skipped: LocaleId[];
}

async function withContext<T>(label: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new GeneratorError(`${label}: ${(error as Error).message}`);
  }
}

interface Sources {
  project: ProjectSettings;
  settings: CreativeSettings;
  screenshots: StoredInput[];
  sets: ScreenshotSets;
  userFrame: UserFrame | null;
}

async function loadSources(workspace: Workspace): Promise<Sources> {
  const project = await readProject(workspace);
  if (!project.targets.apple.enabled) throw new GeneratorError('Enable the App Store in Project to create header and search images');
  const screenshots = await listScreenshots(workspace);
  return {
    project,
    settings: await readCreativeSettings(workspace),
    screenshots,
    sets: await readScreenshotSets(workspace, screenshots),
    userFrame: await withContext('frames/user/iphone', () => loadUserFrame(workspace.userFramesDir, 'iphone')),
  };
}

function creativeSpec(specId: string): SpecEntry {
  if (!CREATIVE_SPEC_IDS.includes(specId)) throw new GeneratorError(`${specId} is not a header or search image`);
  return getSpec(specId);
}

/** Size and safe area of a spec, scaled to `width` (the full size when absent). */
function geometry(spec: SpecEntry, width?: number): { width: number; height: number; safeArea: Rect } {
  const full = cardSizeForSpec(spec);
  if (!spec.safeArea) throw new Error(`${spec.id} has no safe area in the catalogue`);
  const scale = width === undefined ? 1 : width / full.width;
  const s = spec.safeArea;
  return {
    width: Math.round(full.width * scale),
    height: Math.round(full.height * scale),
    safeArea: { x: s.x * scale, y: s.y * scale, width: s.width * scale, height: s.height * scale },
  };
}

/** The screenshots of a locale's set used for the assets, read once per input. */
async function screenshotsFor(workspace: Workspace, entries: readonly EffectiveEntry[], cache: Map<string, Buffer>): Promise<Buffer[]> {
  const used = entries.slice(0, SHOTS);
  for (const entry of used) {
    if (!cache.has(entry.input)) cache.set(entry.input, await readFile(path.join(workspace.root, entry.input)));
  }
  return used.map((entry) => cache.get(entry.input)!);
}

function missingPhrase(locale: LocaleId): string {
  return `No phrase for ${locale}: the images show the screenshot without text`;
}

export interface CreativePreviewRequest {
  locale: string;
  specId: string;
  /** Width of the preview image in pixels (default 640). */
  width?: number;
}

export interface CreativePreview {
  png: Buffer;
  width: number;
  height: number;
  /** Size of the real asset and its safe area in pixels. */
  full: { width: number; height: number; safeArea: Rect };
  /** Safe area as shares of the image size (0 to 1), for the guide overlay. */
  safeArea: Rect;
  warnings: { code: CreativeWarningCode; message: string }[];
  fallbackInput: boolean;
}

const PREVIEW_WIDTH = 640;

/** Renders one creative asset small for the UI: same layout as the full size, scaled down with its safe area. */
export async function renderCreativePreview(workspace: Workspace, request: CreativePreviewRequest): Promise<CreativePreview> {
  if (!isLocaleId(request.locale)) throw new GeneratorError(`${String(request.locale)} is not a supported locale`);
  const spec = creativeSpec(request.specId);
  const width = request.width ?? PREVIEW_WIDTH;
  if (!Number.isInteger(width) || width < 160 || width > 1600) throw new GeneratorError('width must be whole pixels from 160 to 1600');

  const sources = await loadSources(workspace);
  const entries = effectiveSet(sources.sets, request.locale, sources.project.sourceLocale, sources.screenshots);
  if (entries.length === 0) throw new GeneratorError(`Upload screenshots for ${sources.project.sourceLocale} first`);
  const size = geometry(spec, width);
  const phrase = sources.settings.phrases[request.locale] ?? '';
  const result = await withContext(spec.name, async () =>
    renderCreativeAsset({
      ...size,
      background: sources.settings.background,
      phrase,
      screenshots: await screenshotsFor(workspace, entries, new Map()),
      userFrame: sources.userFrame,
    }),
  );
  const full = geometry(spec);
  const s = full.safeArea;
  return {
    png: result.png,
    width: size.width,
    height: size.height,
    full,
    safeArea: { x: s.x / full.width, y: s.y / full.height, width: s.width / full.width, height: s.height / full.height },
    warnings: [...result.warnings, ...(phrase ? [] : [{ code: 'missing-phrase' as const, message: missingPhrase(request.locale) }])],
    fallbackInput: entries.slice(0, SHOTS).some((entry) => entry.fallbackInput),
  };
}

/**
 * Renders the product page header, search results and universal images for every selected language from the first
 * three screenshots of its set (the source language's set when it has none), the background and the language's phrase.
 * Everything is rendered and validated before anything is written; each language then replaces its earlier images.
 */
export async function generateCreativeAssets(workspace: Workspace, options: CreativeAssetOptions = {}): Promise<CreativeAssetResult> {
  const sources = await loadSources(workspace);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? sources.project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }
  if (sources.screenshots.length === 0) throw new GeneratorError(`Upload screenshots for ${sources.project.sourceLocale} first`);

  const cache = new Map<string, Buffer>();
  const perLocale = new Map<LocaleId, RegisterOptions[]>();
  const result: CreativeAssetResult = { entries: [], warnings: [], skipped: [] };

  for (const locale of locales) {
    perLocale.set(locale, []);
    const entries = effectiveSet(sources.sets, locale, sources.project.sourceLocale, sources.screenshots);
    if (entries.length === 0) {
      result.skipped.push(locale);
      continue;
    }
    const phrase = sources.settings.phrases[locale] ?? '';
    if (!phrase) result.warnings.push({ code: 'missing-phrase', message: missingPhrase(locale), path: `apple/${locale}` });
    const screenshots = await screenshotsFor(workspace, entries, cache);
    const fallbackInput = entries.slice(0, SHOTS).some((entry) => entry.fallbackInput);
    for (const image of CREATIVE_IMAGES) {
      const spec = getSpec(image.specId);
      const input: CreativeInput = { ...geometry(spec), background: sources.settings.background, phrase, screenshots, userFrame: sources.userFrame };
      const rendered = await withContext(`${spec.name} (${locale})`, () => renderCreativeAsset(input));
      const file: RegisterOptions = { specId: spec.id, locale, order: 1, name: image.name, extension: 'png', bytes: rendered.png, fallbackInput };
      perLocale.get(locale)!.push(file);
      const filePath = outputPath(spec, file);
      for (const warning of rendered.warnings) result.warnings.push({ ...warning, path: filePath });
    }
  }

  await withContext('Header and search images', () => assertValidOutputs([...perLocale.values()].flat()));
  for (const [locale, files] of perLocale) {
    result.entries.push(...(await registerOutputs(workspace, files, { replaceSets: { specIds: CREATIVE_SPEC_IDS, locales: [locale] } })));
  }
  return result;
}
