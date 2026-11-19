import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { outputPath, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { isLocaleId, selectProjectLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import {
  cardDefaultsForSpec,
  loadUserFrame,
  renderScreenshotCard,
  type CardInput,
  type CardWarningCode,
  type FrameKind,
  type UserFrame,
} from '../screenshots/index.js';
import { SCREENSHOT_MATRIX, getSpec, type SpecEntry, type Target } from '../specs/index.js';
import {
  effectiveSet,
  listScreenshots,
  originalInputName,
  readProject,
  readScreenshotSets,
  type CardStyle,
  type ScreenshotEntry,
  type Workspace,
} from '../workspace/index.js';
import { GeneratorError } from './logo.js';
import { assertValidOutputs } from './outputs.js';

export interface ScreenshotCardOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
}

export interface GenerationWarning {
  code: CardWarningCode | 'too-few-screenshots';
  message: string;
  /** Output path of the card, or `<target>/<locale>/<device>` for a set-level warning. */
  path: string;
}

export interface ScreenshotCardResult {
  entries: OutputEntry[];
  warnings: GenerationWarning[];
  /** Selected languages that have no screenshots at all (neither own nor source). */
  skipped: LocaleId[];
}

const CARD_TARGETS: readonly Target[] = ['apple', 'google'];
/** Every device the cards can be made for; a run replaces all of them, so unpicked devices lose their old cards. */
const ALL_CARD_DEVICES = CARD_TARGETS.flatMap((target) => SCREENSHOT_MATRIX[target]);

/** Runs `work` and turns any failure into a GeneratorError with context, so the API answers 400. */
async function withContext<T>(label: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new GeneratorError(`${label}: ${(error as Error).message}`);
  }
}

/** Loads the user bezel of each device's default frame once into `into`. */
async function loadUserFrames(workspace: Workspace, devices: readonly string[], into: Map<FrameKind, UserFrame | null>): Promise<void> {
  for (const specId of devices) {
    const frame = cardDefaultsForSpec(getSpec(specId)).frame;
    if (!into.has(frame)) into.set(frame, await withContext(`frames/user/${frame}`, () => loadUserFrame(workspace.userFramesDir, frame)));
  }
}

/** The card for one slot on one device: project style, the slot's overrides, and the device's defaults. */
function cardInputFor(
  spec: SpecEntry,
  entry: ScreenshotEntry,
  style: CardStyle,
  screenshot: Uint8Array,
  userFrames: ReadonlyMap<FrameKind, UserFrame | null>,
): CardInput {
  const defaults = cardDefaultsForSpec(spec);
  const frame: FrameKind = entry.frame === 'none' ? 'none' : defaults.frame;
  return {
    ...defaults,
    frame,
    layout: entry.layout ?? style.layout,
    background: entry.background ?? style.background,
    headline: entry.headline,
    subline: entry.subline,
    screenshot,
    userFrame: frame === 'none' ? null : (userFrames.get(frame) ?? null),
  };
}

export interface CardPreviewRequest {
  locale: string;
  /** Screenshot spec id of a matrix device. */
  device: string;
  /** Position in the locale's effective set, starting at 0. */
  index: number;
  /** Width of the preview image in pixels (default 360). */
  width?: number;
}

export interface PreviewWarning {
  code: CardWarningCode | 'not-exported';
  message: string;
}

export interface CardPreview {
  png: Buffer;
  width: number;
  height: number;
  warnings: PreviewWarning[];
  fallbackInput: boolean;
}

const PREVIEW_WIDTH = 360;

/**
 * Renders one card small for the UI preview, from the saved sets: same layout logic as the real card, at a reduced
 * size with the same aspect ratio, so text fitting and warnings match the full-size card.
 */
export async function renderCardPreview(workspace: Workspace, request: CardPreviewRequest): Promise<CardPreview> {
  if (!isLocaleId(request.locale)) throw new GeneratorError(`${String(request.locale)} is not a supported locale`);
  const target = (['apple', 'google'] as const).find((t) => SCREENSHOT_MATRIX[t].includes(request.device));
  if (!target) throw new GeneratorError(`${String(request.device)} is not a device of the device matrix`);
  const width = request.width ?? PREVIEW_WIDTH;
  if (!Number.isInteger(request.index) || request.index < 0) throw new GeneratorError('index must be a whole number from 0');
  if (!Number.isInteger(width) || width < 100 || width > 1200) throw new GeneratorError('width must be whole pixels from 100 to 1200');

  const project = await readProject(workspace);
  if (!project.locales.includes(request.locale)) throw new GeneratorError(`${request.locale} is not a locale of this project`);
  const screenshots = await listScreenshots(workspace);
  const sets = await readScreenshotSets(workspace, screenshots);
  const entry = effectiveSet(sets, request.locale, project.sourceLocale, screenshots)[request.index];
  if (!entry) throw new GeneratorError(`There is no screenshot ${request.index + 1} for ${request.locale}`);

  const spec = getSpec(request.device);
  const userFrames = new Map<FrameKind, UserFrame | null>();
  await loadUserFrames(workspace, [request.device], userFrames);
  const full = cardInputFor(spec, entry, sets.style, await readFile(path.join(workspace.root, entry.input)), userFrames);
  const height = Math.round((width * full.height) / full.width);
  const card = await withContext(entry.input, () =>
    // The text share limit is relative, so it applies unchanged to the smaller preview.
    renderScreenshotCard({ ...full, width, height }),
  );
  // The store takes only the first maxCount screenshots; say so instead of showing a card that is never exported.
  const warnings: PreviewWarning[] = [...card.warnings];
  if (spec.maxCount !== undefined && request.index >= spec.maxCount) {
    warnings.push({ code: 'not-exported', message: `${spec.name} takes only the first ${spec.maxCount} screenshots; this one is not exported` });
  }
  return { png: card.png, width, height, warnings, fallbackInput: entry.fallbackInput };
}

/**
 * Renders the store screenshot cards: for every selected language, every enabled store device of the matrix that the
 * project picked, and every screenshot of the language's set (up to the device's catalogue maximum). Languages
 * without own screenshots use the source language's set and are marked as fallback input; identical cards are
 * rendered once and reused. Everything is rendered and validated before anything is written; then each language
 * replaces its earlier cards of all devices (also unpicked ones and languages that have no screenshots any more).
 */
export async function generateScreenshotCards(workspace: Workspace, options: ScreenshotCardOptions = {}): Promise<ScreenshotCardResult> {
  const project = await readProject(workspace);
  let locales: LocaleId[];
  try {
    locales = selectProjectLocales(project.locales, options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }

  const devices = CARD_TARGETS.flatMap((target) =>
    project.targets[target].enabled ? project.targets[target].devices.filter((id) => SCREENSHOT_MATRIX[target].includes(id)) : [],
  );
  if (devices.length === 0) throw new GeneratorError('Pick at least one App Store or Google Play device in Project');

  const screenshots = await listScreenshots(workspace);
  const sets = await readScreenshotSets(workspace, screenshots);

  // User bezels are loaded once per frame kind for the whole run.
  const userFrames = new Map<FrameKind, UserFrame | null>();
  await loadUserFrames(workspace, devices, userFrames);

  const bytes = new Map<string, Buffer>();
  const rendered = new Map<string, { png: Buffer; warnings: { code: CardWarningCode; message: string }[] }>();
  const perLocale = new Map<LocaleId, RegisterOptions[]>();
  const result: ScreenshotCardResult = { entries: [], warnings: [], skipped: [] };

  for (const locale of locales) {
    const entries = effectiveSet(sets, locale, project.sourceLocale, screenshots);
    perLocale.set(locale, []);
    if (entries.length === 0) {
      result.skipped.push(locale);
      continue;
    }
    for (const specId of devices) {
      const spec = getSpec(specId);
      const used = entries.slice(0, spec.maxCount ?? entries.length);
      if (spec.minCount !== undefined && used.length < spec.minCount) {
        result.warnings.push({
          code: 'too-few-screenshots',
          message: `${spec.name} needs at least ${spec.minCount} screenshots; this set has ${used.length}`,
          path: `${spec.target}/${locale}/${specId.split('.').pop()}`,
        });
      }
      for (const [index, entry] of used.entries()) {
        if (!bytes.has(entry.input)) bytes.set(entry.input, await readFile(path.join(workspace.root, entry.input)));
        const input = cardInputFor(spec, entry, sets.style, bytes.get(entry.input)!, userFrames);
        // Fallback locales share screenshot, texts and style with the source locale: render each distinct card once.
        const key = JSON.stringify([specId, entry.input, entry.headline, entry.subline, input.layout, input.background, input.frame]);
        let card = rendered.get(key);
        if (!card) {
          card = await withContext(`${entry.input} (${spec.name}, ${locale})`, () => renderScreenshotCard(input));
          rendered.set(key, card);
        }
        const file: RegisterOptions = {
          specId,
          locale,
          order: index + 1,
          name: originalInputName(entry.input),
          extension: 'png',
          bytes: card.png,
          fallbackInput: entry.fallbackInput,
        };
        perLocale.get(locale)!.push(file);
        const filePath = outputPath(spec, file);
        for (const warning of card.warnings) result.warnings.push({ ...warning, path: filePath });
      }
    }
  }

  const allFiles = [...perLocale.values()].flat();
  // Only a project without any screenshot is an error; languages without one are skipped and still cleaned up below.
  if (screenshots.length === 0) throw new GeneratorError(`Upload screenshots for ${project.sourceLocale} first`);
  await withContext('Screenshot cards', () => assertValidOutputs(allFiles));

  for (const [locale, files] of perLocale) {
    result.entries.push(...(await registerOutputs(workspace, files, { replaceSets: { specIds: ALL_CARD_DEVICES, locales: [locale] } })));
  }
  return result;
}
