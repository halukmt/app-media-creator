import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import { ICON_SAFE_RADIUS, variantRenderer } from './environments.js';
import { GeneratorError, loadNewestLogo } from './logo.js';
import { assertValidOutputs, squareSize } from './outputs.js';
import { isHexColor, renderLogoSquare, type HexColor } from './render.js';

export interface AppStoreIconOptions {
  /** Background of the App Store icon and of the Icon Composer background layer. Default white. */
  background?: HexColor;
  /** Share of the canvas the logo box takes, 0.4 to 0.8 (clamped). Default 0.7. */
  logoScale?: number;
}

/**
 * Chosen safe limit for the logo box. iOS masks the canvas with a rounded square (corner radius about 22 %); a centred
 * box stays inside that mask up to about 87 %. 80 % keeps a margin to the rounded corners and the Liquid Glass edge.
 */
export const MAX_LOGO_SCALE = 0.8;
export const MIN_LOGO_SCALE = 0.4;
export const DEFAULT_LOGO_SCALE = 0.7;

export function clampLogoScale(scale: number | undefined): number {
  if (scale === undefined || !Number.isFinite(scale)) return DEFAULT_LOGO_SCALE;
  return Math.min(MAX_LOGO_SCALE, Math.max(MIN_LOGO_SCALE, scale));
}

async function solid(size: number, background: HexColor): Promise<Buffer> {
  return sharp({ create: { width: size, height: size, channels: 3, background } }).png().toBuffer();
}

/**
 * Generates the App Store icon, its dark and tinted appearances and the Icon Composer layers from the newest uploaded
 * logo, plus the same set per non-production environment of the project (`apple/<environment>/…`). All files are
 * rendered and validated first, then registered as one batch.
 * Throws GeneratorError for a missing or unreadable logo or an invalid colour.
 */
export async function generateAppStoreIcons(workspace: Workspace, options: AppStoreIconOptions = {}): Promise<OutputEntry[]> {
  if (options.background !== undefined && !isHexColor(options.background)) {
    throw new GeneratorError('background must be a colour like #1a2b3c');
  }
  const background = options.background ?? '#ffffff';
  const scale = clampLogoScale(options.logoScale);
  const logo = await loadNewestLogo(workspace);

  const size = squareSize('apple.icon');
  for (const id of ['apple.icon-dark', 'apple.icon-tinted', 'apple.icon-layer-background', 'apple.icon-layer-foreground']) {
    if (squareSize(id) !== size) throw new Error(`${id} must have the size of apple.icon`);
  }
  const logoBox = Math.round(size * scale);

  // The dark appearance and the foreground layer are the same render: the logo on transparency.
  const [icon, onTransparent, tinted, layerBackground] = await Promise.all([
    renderLogoSquare(logo, { size, logoBox, background }),
    renderLogoSquare(logo, { size, logoBox }),
    renderLogoSquare(logo, { size, logoBox, grayscale: true }),
    solid(size, background),
  ]);

  const files: RegisterOptions[] = [
    { specId: 'apple.icon', name: 'app-icon', extension: 'png', order: 1, bytes: icon },
    { specId: 'apple.icon-dark', name: 'app-icon-dark', extension: 'png', order: 1, bytes: onTransparent },
    { specId: 'apple.icon-tinted', name: 'app-icon-tinted', extension: 'png', order: 1, bytes: tinted },
    { specId: 'apple.icon-layer-background', name: 'background', extension: 'png', order: 1, bytes: layerBackground },
    { specId: 'apple.icon-layer-foreground', name: 'foreground', extension: 'png', order: 1, bytes: onTransparent },
  ];
  const { environments } = await readProject(workspace);
  for (const environment of environments) {
    const variant = variantRenderer(logo, environment);
    const [variantIcon, variantTransparent, variantBackground] = await Promise.all([
      variant.opaque(size, logoBox, background, ICON_SAFE_RADIUS),
      variant.transparent(size, logoBox, ICON_SAFE_RADIUS),
      variant.backgroundLayer(size, background),
    ]);
    const variantTinted = await sharp(variantTransparent).greyscale().png().toBuffer();
    const environmentId = environment.id;
    files.push(
      { specId: 'apple.icon', environment: environmentId, name: 'app-icon', extension: 'png', order: 1, bytes: variantIcon },
      { specId: 'apple.icon-dark', environment: environmentId, name: 'app-icon-dark', extension: 'png', order: 1, bytes: variantTransparent },
      { specId: 'apple.icon-tinted', environment: environmentId, name: 'app-icon-tinted', extension: 'png', order: 1, bytes: variantTinted },
      { specId: 'apple.icon-layer-background', environment: environmentId, name: 'background', extension: 'png', order: 1, bytes: variantBackground },
      { specId: 'apple.icon-layer-foreground', environment: environmentId, name: 'foreground', extension: 'png', order: 1, bytes: variantTransparent },
    );
  }
  await assertValidOutputs(files);
  // A full set per run: files of environments that were removed from the project go away.
  return registerOutputs(workspace, files, { replaceSets: { specIds: [...new Set(files.map((f) => f.specId))], locales: [undefined] } });
}
