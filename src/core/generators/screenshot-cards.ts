import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { outputPath, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { cardDefaultsForSpec, loadUserFrame, renderScreenshotCard, type CardWarning, type FrameKind, type UserFrame } from '../screenshots/index.js';
import { SCREENSHOT_MATRIX, getSpec, type Target } from '../specs/index.js';
import {
  effectiveSet,
  listInputs,
  originalInputName,
  readProject,
  readScreenshotSets,
  type Workspace,
} from '../workspace/index.js';
import { GeneratorError } from './logo.js';
import { assertValidOutputs } from './outputs.js';

export interface ScreenshotCardOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
}

export interface CardFileWarning extends CardWarning {
  /** Output path of the card the warning belongs to. */
  path: string;
}

export interface ScreenshotCardResult {
  entries: OutputEntry[];
  warnings: CardFileWarning[];
  /** Selected languages that have no screenshots at all (neither own nor source). */
  skipped: LocaleId[];
}

const CARD_TARGETS: readonly Target[] = ['apple', 'google'];

/**
 * Renders the store screenshot cards: for every selected language, every enabled store device of the matrix that the
 * project picked, and every screenshot of the language's set (up to the device's catalogue maximum). Languages
 * without own screenshots use the source language's set and are marked as fallback input. Each language is
 * validated and registered as one batch that replaces its earlier cards.
 */
export async function generateScreenshotCards(workspace: Workspace, options: ScreenshotCardOptions = {}): Promise<ScreenshotCardResult> {
  const project = await readProject(workspace);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }

  const devices = CARD_TARGETS.flatMap((target) =>
    project.targets[target].enabled ? project.targets[target].devices.filter((id) => SCREENSHOT_MATRIX[target].includes(id)) : [],
  );
  if (devices.length === 0) throw new GeneratorError('Pick at least one App Store or Google Play device in Project');

  const sets = await readScreenshotSets(workspace);
  const screenshots = (await listInputs(workspace)).filter((input) => input.kind === 'screenshot');
  // User bezels are loaded once per frame kind for the whole run.
  const userFrames = new Map<FrameKind, UserFrame | null>();
  for (const specId of devices) {
    const frame = cardDefaultsForSpec(getSpec(specId)).frame;
    if (userFrames.has(frame)) continue;
    try {
      userFrames.set(frame, await loadUserFrame(workspace.userFramesDir, frame));
    } catch (error) {
      throw new GeneratorError((error as Error).message);
    }
  }

  const result: ScreenshotCardResult = { entries: [], warnings: [], skipped: [] };
  for (const locale of locales) {
    const entries = effectiveSet(sets, locale, project.sourceLocale, screenshots);
    if (entries.length === 0) {
      result.skipped.push(locale);
      continue;
    }
    const bytes = new Map<string, Buffer>();
    for (const entry of entries) bytes.set(entry.input, await readFile(path.join(workspace.root, entry.input)));

    const files: RegisterOptions[] = [];
    const fileWarnings: CardFileWarning[] = [];
    for (const specId of devices) {
      const spec = getSpec(specId);
      const defaults = cardDefaultsForSpec(spec);
      const userFrame = userFrames.get(defaults.frame) ?? null;
      for (const [index, entry] of entries.slice(0, spec.maxCount ?? entries.length).entries()) {
        const name = originalInputName(entry.input);
        let rendered;
        try {
          rendered = await renderScreenshotCard({
            ...defaults,
            layout: sets.style.layout,
            background: sets.style.background,
            headline: entry.headline,
            subline: entry.subline,
            screenshot: bytes.get(entry.input)!,
            userFrame,
          });
        } catch (error) {
          throw new GeneratorError(`${entry.input} (${spec.name}, ${locale}): ${(error as Error).message}`);
        }
        const file: RegisterOptions = {
          specId,
          locale,
          order: index + 1,
          name,
          extension: 'png',
          bytes: rendered.png,
          fallbackInput: entry.fallbackInput,
        };
        files.push(file);
        const filePath = outputPath(spec, file);
        for (const warning of rendered.warnings) fileWarnings.push({ ...warning, path: filePath });
      }
    }
    await assertValidOutputs(files);
    const registered = await registerOutputs(workspace, files, { replaceSets: { specIds: devices, locales: [locale] } });
    result.entries.push(...registered);
    result.warnings.push(...fileWarnings);
  }

  if (result.entries.length === 0) throw new GeneratorError(`Upload screenshots for ${project.sourceLocale} first`);
  return result;
}
