import { lstat } from 'node:fs/promises';
import path from 'node:path';
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
  try {
    return await loadLogo(await newestLogo(workspace));
  } catch (error) {
    if (error instanceof GeneratorError) throw error;
    throw new GeneratorError('The uploaded logo cannot be read; upload it again as PNG, JPEG, WebP or SVG');
  }
}
