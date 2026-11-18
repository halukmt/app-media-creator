import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { CardInputError, isFrameKind, renderFramedScreenshot, type FrameKind } from '../screenshots/index.js';
import { getSpec } from '../specs/index.js';
import { listInputs, originalInputName, readProject, type Workspace } from '../workspace/index.js';
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

/**
 * Generates website screenshots: every uploaded screenshot of the selected languages in a device frame on
 * transparency, as PNG and WebP in `1x` and `2x`, into `web/<locale>/framed-screenshots/<scale>x/`.
 * Languages without their own screenshots are skipped (a website shows its own language's screens).
 * All files are rendered and validated before anything is written.
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

  const baseWidth = getSpec(PNG_SPEC).defaultSize?.width;
  if (!baseWidth) throw new Error(`${PNG_SPEC} has no default size`);

  const screenshots = (await listInputs(workspace)).filter(
    (input) => input.kind === 'screenshot' && input.locale !== undefined && locales.includes(input.locale),
  );
  if (screenshots.length === 0) {
    throw new GeneratorError(`Upload screenshots for ${locales.join(', ')} first`);
  }

  const files: RegisterOptions[] = [];
  for (const locale of locales) {
    const ofLocale = screenshots.filter((input) => input.locale === locale);
    for (const [index, input] of ofLocale.entries()) {
      const bytes = await readFile(path.join(workspace.root, input.path));
      const name = originalInputName(input.path);
      for (const scale of SCALES) {
        let png: Buffer;
        try {
          png = await renderFramedScreenshot({
            screenshot: bytes,
            frame,
            deviceWidth: baseWidth * scale,
            ...(options.shadow !== undefined ? { shadow: options.shadow } : {}),
            userFramesDir: workspace.userFramesDir,
          });
        } catch (error) {
          if (error instanceof CardInputError) throw new GeneratorError(`${input.path}: ${error.message}`);
          throw error;
        }
        const webp = await sharp(png).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
        const position = { locale, order: index + 1, name, subfolder: `${scale}x` };
        files.push({ specId: PNG_SPEC, ...position, extension: 'png', bytes: png });
        files.push({ specId: WEBP_SPEC, ...position, extension: 'webp', bytes: webp });
      }
    }
  }

  await assertValidOutputs(files);
  return registerOutputs(workspace, files);
}
