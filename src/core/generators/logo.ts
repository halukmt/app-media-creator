import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { getSpec } from '../specs/index.js';
import { listInputs } from '../workspace/inputs.js';
import type { Workspace } from '../workspace/workspace.js';
import { loadLogo, type LogoSource } from './render.js';

/** The request cannot be served (e.g. no logo uploaded, unreadable logo, invalid option). */
export class GeneratorError extends Error {}

/** Absolute path of the most recently changed uploaded logo. Only regular files count. */
export async function newestLogo(workspace: Workspace): Promise<string> {
  const logos = (await listInputs(workspace)).filter((input) => input.kind === 'logo');
  const dated = [];
  for (const logo of logos) {
    const absolute = path.join(workspace.root, logo.path);
    const info = await lstat(absolute);
    // A link planted in a cloned workspace must not pull in a file from elsewhere.
    if (info.isFile()) dated.push({ absolute, modified: info.mtimeMs });
  }
  if (dated.length === 0) throw new GeneratorError('Upload a logo first');
  dated.sort((x, y) => x.modified - y.modified || x.absolute.localeCompare(y.absolute));
  return dated.at(-1)!.absolute;
}

/** Loads the newest uploaded logo; throws GeneratorError when there is none or it cannot be read. */
export async function loadNewestLogo(workspace: Workspace): Promise<LogoSource> {
  return loadUploadedLogo(await newestLogo(workspace));
}

/** Loads one uploaded logo file (from `newestLogo`); throws GeneratorError when it cannot be read. */
export async function loadUploadedLogo(file: string): Promise<LogoSource> {
  try {
    return await loadLogo(file);
  } catch {
    throw new GeneratorError('The uploaded logo cannot be read; upload it again as PNG, JPEG, WebP or SVG');
  }
}

export interface LogoReport {
  /** `svg`, `png`, `jpeg` or `webp` (by content). */
  format: string;
  width: number;
  height: number;
  isSvg: boolean;
  status: 'ok' | 'warning';
  messages: string[];
}

/** Side of the largest icon a logo is drawn into: the App Store icon from the specs catalogue. */
function largestIconSide(): number {
  const rule = getSpec('apple.icon').dimensions;
  return rule.kind === 'fixed' ? Math.max(...rule.sizes.map((s) => Math.min(s.width, s.height))) : 1024;
}

/**
 * Size and fitness of an uploaded logo for the icon packs (#64): a raster logo smaller than the largest icon is
 * upscaled, a logo that is not square is padded. SVG logos scale without loss and are only checked for their shape.
 */
export function describeLogo(logo: LogoSource, format: string): LogoReport {
  const messages: string[] = [];
  const side = largestIconSide();
  const shorter = Math.min(logo.width, logo.height);
  if (!logo.isSvg && shorter < side) {
    messages.push(`Smaller than the ${side} px App Store icon (${shorter} px); the larger icons are upscaled and may look soft`);
  }
  if (logo.width !== logo.height) messages.push('Not square; the icons show it centred with space around it');
  return {
    format: logo.isSvg ? 'svg' : format,
    width: logo.width,
    height: logo.height,
    isSvg: logo.isSvg,
    status: messages.length > 0 ? 'warning' : 'ok',
    messages,
  };
}
