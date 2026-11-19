import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { isFrameKind, loadUserFrame, renderFramedScreenshot, type FrameKind, type UserFrame } from '../screenshots/index.js';
import { getSpec } from '../specs/index.js';
import { listInputs, originalInputName, readProject, type StoredInput, type Workspace } from '../workspace/index.js';
import { GeneratorError } from './logo.js';
import { assertValidOutputs } from './outputs.js';

export interface FramedScreenshotOptions {
  /** Device frame around every screenshot (default `iphone`). */
  frame?: FrameKind;
  /** Soft drop shadow under the device (default true). */
  shadow?: boolean;
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
}

const PNG_SPEC = 'web.framed-screenshot';
const WEBP_SPEC = 'web.framed-screenshot-webp';
const SCALES = [1, 2] as const;

/** Runs `work` and turns any failure into a GeneratorError that names the file, so the API answers 400. */
async function forFile<T>(label: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw new GeneratorError(`${label}: ${(error as Error).message}`);
  }
}

/** The four files (PNG and WebP, 1x and 2x) of one screenshot. */
async function filesOf(
  input: StoredInput & { locale: LocaleId },
  order: number,
  workspace: Workspace,
  settings: { frame: FrameKind; shadow: boolean | undefined; userFrame: UserFrame | null; baseWidth: number; edges: { min: number; max: number } },
): Promise<RegisterOptions[]> {
  const bytes = await readFile(path.join(workspace.root, input.path));
  const name = originalInputName(input.path);
  const perScale = await Promise.all(
    SCALES.map(async (scale) => {
      const png = await renderFramedScreenshot({
        screenshot: bytes,
        frame: settings.frame,
        deviceWidth: settings.baseWidth * scale,
        ...(settings.shadow !== undefined ? { shadow: settings.shadow } : {}),
        userFrame: settings.userFrame,
        edges: settings.edges,
      });
      const webp = await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
      const position = { locale: input.locale, order, name, subfolder: `${scale}x` };
      return [
        { specId: PNG_SPEC, ...position, extension: 'png', bytes: png },
        { specId: WEBP_SPEC, ...position, extension: 'webp', bytes: webp },
      ];
    }),
  );
  return perScale.flat();
}

/**
 * Generates website screenshots: every uploaded screenshot of the selected languages in a device frame on
 * transparency, as PNG and WebP in `1x` and `2x`, into `web/<locale>/framed-screenshots/<scale>x/`.
 * Languages without their own screenshots are skipped (a website shows its own language's screens). The run replaces
 * the earlier website screenshots of the selected languages completely, so deleted screenshots disappear.
 * All files are rendered and validated before anything is written; problems are reported with the file name.
 */
export async function generateFramedScreenshots(workspace: Workspace, options: FramedScreenshotOptions = {}): Promise<OutputEntry[]> {
  const frame = options.frame ?? 'iphone';
  if (!isFrameKind(frame)) throw new GeneratorError(`Unknown frame: ${String(frame)}`);
  if (options.shadow !== undefined && typeof options.shadow !== 'boolean') throw new GeneratorError('shadow must be true or false');

  const project = await readProject(workspace);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }

  const spec = getSpec(PNG_SPEC);
  const baseWidth = spec.baseWidth;
  if (!baseWidth || spec.dimensions.kind !== 'range' || !spec.dimensions.minSide || !spec.dimensions.maxSide) {
    throw new Error(`${PNG_SPEC} needs a base width and a side range`);
  }
  const edges = { min: spec.dimensions.minSide, max: spec.dimensions.maxSide };

  const screenshots = (await listInputs(workspace)).filter(
    (input): input is StoredInput & { locale: LocaleId } =>
      input.kind === 'screenshot' && input.locale !== undefined && locales.includes(input.locale),
  );
  if (screenshots.length === 0) throw new GeneratorError(`Upload screenshots for ${locales.join(', ')} first`);

  // The bezel is the same for the whole run: load (and check) it once.
  const userFrame = await forFile(`frames/user/${frame}`, () => loadUserFrame(workspace.userFramesDir, frame));
  const settings = { frame, shadow: options.shadow, userFrame, baseWidth, edges };

  const files: RegisterOptions[] = [];
  for (const locale of locales) {
    const ofLocale = screenshots.filter((input) => input.locale === locale);
    for (const [index, input] of ofLocale.entries()) {
      files.push(...(await forFile(input.path, () => filesOf(input, index + 1, workspace, settings))));
    }
  }

  // A file outside the catalogue limits (e.g. a very tall full-page screenshot) is a user problem, not a crash.
  await forFile('Website screenshots', () => assertValidOutputs(files));
  return registerOutputs(workspace, files, { replaceSets: { specIds: [PNG_SPEC, WEBP_SPEC], locales } });
}
