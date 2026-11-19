import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { outputPath, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { cardDefaultsForSpec, loadUserFrame, renderScreenshotCard, type CardWarningCode, type FrameKind, type UserFrame } from '../screenshots/index.js';
import { SCREENSHOT_MATRIX, getSpec, type Target } from '../specs/index.js';
import { effectiveSet, listScreenshots, originalInputName, readProject, readScreenshotSets, type Workspace } from '../workspace/index.js';
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
    locales = options.locales === undefined ? project.locales : resolveLocales(options.locales);
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
  for (const specId of devices) {
    const frame = cardDefaultsForSpec(getSpec(specId)).frame;
    if (!userFrames.has(frame)) userFrames.set(frame, await withContext(`frames/user/${frame}`, () => loadUserFrame(workspace.userFramesDir, frame)));
  }

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
      const defaults = cardDefaultsForSpec(spec);
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
        // Fallback locales share screenshot and texts with the source locale: render each distinct card once.
        const key = JSON.stringify([specId, entry.input, entry.headline, entry.subline]);
        let card = rendered.get(key);
        if (!card) {
          card = await withContext(`${entry.input} (${spec.name}, ${locale})`, () =>
            renderScreenshotCard({
              ...defaults,
              layout: sets.style.layout,
              background: sets.style.background,
              headline: entry.headline,
              subline: entry.subline,
              screenshot: bytes.get(entry.input)!,
              userFrame: userFrames.get(defaults.frame) ?? null,
            }),
          );
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
  if (allFiles.length === 0) throw new GeneratorError(`Upload screenshots for ${project.sourceLocale} first`);
  await withContext('Screenshot cards', () => assertValidOutputs(allFiles));

  for (const [locale, files] of perLocale) {
    result.entries.push(...(await registerOutputs(workspace, files, { replaceSets: { specIds: ALL_CARD_DEVICES, locales: [locale] } })));
  }
  return result;
}
