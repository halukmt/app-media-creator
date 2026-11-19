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

/**
 * Store artwork made from the screenshots, a background and one phrase per locale, in two groups:
 * - `header`: App Store product page header, search results and universal images (iOS 27);
 * - `feature`: the Google Play feature graphic and the App Store in-app event card and details images.
 */
export const CREATIVE_GROUPS = ['header', 'feature'] as const;
export type CreativeGroup = (typeof CREATIVE_GROUPS)[number];

export interface CreativeImage {
  specId: string;
  /** File name without extension. */
  name: string;
  group: CreativeGroup;
  /** Whether the phrase is drawn; Apple asks for no own text on in-app event media. */
  text: boolean;
  /**
   * Where the key art goes, as shares of the image, for specs without a store safe area: centred, because Google Play
   * asks to keep key elements in the centre and Apple overlays the event title at the bottom of the details page.
   */
  keyArea?: Rect;
}

export const CREATIVE_IMAGES: readonly CreativeImage[] = [
  { specId: 'apple.creative.header-image', name: 'header', group: 'header', text: true },
  { specId: 'apple.creative.search-image', name: 'search', group: 'header', text: true },
  { specId: 'apple.creative.universal-image', name: 'universal', group: 'header', text: true },
  { specId: 'google.feature-graphic', name: 'feature-graphic', group: 'feature', text: true, keyArea: { x: 0.15, y: 0.1, width: 0.7, height: 0.8 } },
  { specId: 'apple.event.card-image', name: 'event-card', group: 'feature', text: false, keyArea: { x: 0.25, y: 0.12, width: 0.5, height: 0.76 } },
  { specId: 'apple.event.details-image', name: 'event-details', group: 'feature', text: false, keyArea: { x: 0.1, y: 0.1, width: 0.8, height: 0.5 } },
];
/** Screenshots one asset uses: the key art plus the ones on the sides. */
const SHOTS = 3;

export type CreativeWarningCode = TextWarningCode | 'missing-phrase';

export interface CreativeWarning {
  code: CreativeWarningCode;
  message: string;
  /** Output path of the image, or `<target>/<locale>` for a locale-level warning. */
  path: string;
}

export interface CreativeAssetOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
  /** Which images to generate (default `header`). */
  group?: CreativeGroup;
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
  const screenshots = await listScreenshots(workspace);
  return {
    project,
    settings: await readCreativeSettings(workspace),
    screenshots,
    sets: await readScreenshotSets(workspace, screenshots),
    userFrame: await withContext('frames/user/iphone', () => loadUserFrame(workspace.userFramesDir, 'iphone')),
  };
}

function isCreativeGroup(value: unknown): value is CreativeGroup {
  return typeof value === 'string' && (CREATIVE_GROUPS as readonly string[]).includes(value);
}

/** The images of a group whose store is enabled in the project; fails with a message when there are none. */
function enabledImages(project: ProjectSettings, group: CreativeGroup): CreativeImage[] {
  const images = CREATIVE_IMAGES.filter((image) => image.group === group && project.targets[getSpec(image.specId).target].enabled);
  if (images.length === 0) {
    throw new GeneratorError(
      group === 'header'
        ? 'Enable the App Store in Project to create header and search images'
        : 'Enable Google Play or the App Store in Project to create the feature graphic and event images',
    );
  }
  return images;
}

function creativeImage(specId: string): CreativeImage {
  const image = CREATIVE_IMAGES.find((candidate) => candidate.specId === specId);
  if (!image) throw new GeneratorError(`${specId} is not a store artwork image`);
  return image;
}

/** Size and key-art area of an image (the store safe area, or the centred key area), scaled to `width`. */
export function creativeGeometry(image: CreativeImage, width?: number): { width: number; height: number; safeArea: Rect } {
  const spec = getSpec(image.specId);
  const full = cardSizeForSpec(spec);
  const area: Rect | undefined =
    spec.safeArea ??
    (image.keyArea
      ? { x: image.keyArea.x * full.width, y: image.keyArea.y * full.height, width: image.keyArea.width * full.width, height: image.keyArea.height * full.height }
      : undefined);
  if (!area) throw new Error(`${spec.id} has neither a safe area in the catalogue nor a key area`);
  const scale = width === undefined ? 1 : width / full.width;
  return {
    width: Math.round(full.width * scale),
    height: Math.round(full.height * scale),
    safeArea: { x: area.x * scale, y: area.y * scale, width: area.width * scale, height: area.height * scale },
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
  /** Size of the real asset and its key-art area in pixels. */
  full: { width: number; height: number; safeArea: Rect };
  /** Key-art area as shares of the image size (0 to 1), for the guide overlay. */
  safeArea: Rect;
  warnings: { code: CreativeWarningCode; message: string }[];
  fallbackInput: boolean;
}

const PREVIEW_WIDTH = 640;

/** Renders one image small for the UI: same layout as the full size, scaled down with its key-art area. */
export async function renderCreativePreview(workspace: Workspace, request: CreativePreviewRequest): Promise<CreativePreview> {
  if (!isLocaleId(request.locale)) throw new GeneratorError(`${String(request.locale)} is not a supported locale`);
  const image = creativeImage(request.specId);
  const width = request.width ?? PREVIEW_WIDTH;
  if (!Number.isInteger(width) || width < 160 || width > 1600) throw new GeneratorError('width must be whole pixels from 160 to 1600');

  const sources = await loadSources(workspace);
  if (!enabledImages(sources.project, image.group).includes(image)) {
    throw new GeneratorError(`Enable ${getSpec(image.specId).target === 'apple' ? 'the App Store' : 'Google Play'} in Project for this image`);
  }
  const entries = effectiveSet(sources.sets, request.locale, sources.project.sourceLocale, sources.screenshots);
  if (entries.length === 0) throw new GeneratorError(`Upload screenshots for ${sources.project.sourceLocale} first`);
  const size = creativeGeometry(image, width);
  const phrase = image.text ? (sources.settings.phrases[request.locale] ?? '') : '';
  const result = await withContext(getSpec(image.specId).name, async () =>
    renderCreativeAsset({ ...size, background: sources.settings.background, phrase, screenshots: await screenshotsFor(workspace, entries, new Map()), userFrame: sources.userFrame }),
  );
  const full = creativeGeometry(image);
  const s = full.safeArea;
  return {
    png: result.png,
    width: size.width,
    height: size.height,
    full,
    safeArea: { x: s.x / full.width, y: s.y / full.height, width: s.width / full.width, height: s.height / full.height },
    warnings: [...result.warnings, ...(image.text && !phrase ? [{ code: 'missing-phrase' as const, message: missingPhrase(request.locale) }] : [])],
    fallbackInput: entries.slice(0, SHOTS).some((entry) => entry.fallbackInput),
  };
}

/**
 * Renders the images of one group for every selected language from the first three screenshots of its set (the source
 * language's set when it has none), the background and the language's phrase. Only images of enabled stores are made.
 * Everything is rendered and validated before anything is written; each language then replaces its earlier images.
 */
export async function generateCreativeAssets(workspace: Workspace, options: CreativeAssetOptions = {}): Promise<CreativeAssetResult> {
  const group = options.group ?? 'header';
  if (!isCreativeGroup(group)) throw new GeneratorError(`group must be one of ${CREATIVE_GROUPS.join(', ')}`);
  const sources = await loadSources(workspace);
  const images = enabledImages(sources.project, group);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? sources.project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }
  if (sources.screenshots.length === 0) throw new GeneratorError(`Upload screenshots for ${sources.project.sourceLocale} first`);

  const cache = new Map<string, Buffer>();
  // Text-free images (event card and details) of languages with the same screenshots are identical: rendered once.
  const rendered = new Map<string, Awaited<ReturnType<typeof renderCreativeAsset>>>();
  const perLocale = new Map<LocaleId, RegisterOptions[]>();
  const result: CreativeAssetResult = { entries: [], warnings: [], skipped: [] };
  const withText = images.filter((image) => image.text);

  for (const locale of locales) {
    perLocale.set(locale, []);
    const entries = effectiveSet(sources.sets, locale, sources.project.sourceLocale, sources.screenshots);
    if (entries.length === 0) {
      result.skipped.push(locale);
      continue;
    }
    const phrase = sources.settings.phrases[locale] ?? '';
    if (!phrase && withText.length > 0) {
      result.warnings.push({ code: 'missing-phrase', message: missingPhrase(locale), path: `${getSpec(withText[0]!.specId).target}/${locale}` });
    }
    const screenshots = await screenshotsFor(workspace, entries, cache);
    const fallbackInput = entries.slice(0, SHOTS).some((entry) => entry.fallbackInput);
    for (const image of images) {
      const spec = getSpec(image.specId);
      const input: CreativeInput = {
        ...creativeGeometry(image),
        background: sources.settings.background,
        phrase: image.text ? phrase : '',
        screenshots,
        userFrame: sources.userFrame,
      };
      const key = JSON.stringify([image.specId, input.phrase, entries.slice(0, SHOTS).map((entry) => entry.input)]);
      let drawn = rendered.get(key);
      if (!drawn) {
        drawn = await withContext(`${spec.name} (${locale})`, () => renderCreativeAsset(input));
        rendered.set(key, drawn);
      }
      const file: RegisterOptions = { specId: spec.id, locale, order: 1, name: image.name, extension: 'png', bytes: drawn.png, fallbackInput };
      perLocale.get(locale)!.push(file);
      const filePath = outputPath(spec, file);
      for (const warning of drawn.warnings) result.warnings.push({ ...warning, path: filePath });
    }
  }

  await withContext(group === 'header' ? 'Header and search images' : 'Feature graphic and event images', () =>
    assertValidOutputs([...perLocale.values()].flat()),
  );
  // Each run replaces the whole group of a language, also images of a store that was switched off since.
  const groupSpecIds = CREATIVE_IMAGES.filter((image) => image.group === group).map((image) => image.specId);
  for (const [locale, files] of perLocale) {
    result.entries.push(...(await registerOutputs(workspace, files, { replaceSets: { specIds: groupSpecIds, locales: [locale] } })));
  }
  return result;
}
