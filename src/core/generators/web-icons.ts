import { lstat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { getSpec, inspectImageBytes, validateMedia, type Size } from '../specs/index.js';
import { listInputs } from '../workspace/inputs.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import { encodeIco, isHexColor, loadLogo, renderLogoSquare, svgDensity, type HexColor, type LogoSource } from './render.js';

/** The request cannot be served (e.g. no logo uploaded, unreadable logo). */
export class GeneratorError extends Error {}

export interface WebIconOptions {
  /** Background of icons that must be opaque, and of icon.svg in light mode. Default white. */
  background?: HexColor;
  /** Background of icon.svg in dark mode. Default near-black. */
  darkBackground?: HexColor;
  /** `theme-color` of the manifest and the head snippet. Default: the background. */
  themeColor?: HexColor;
}

/** Apple's touch icon guidance: about 140 px of artwork on 180 px. */
const TOUCH_ARTWORK_RATIO = 140 / 180;
/** Margin around the logo of transparent manifest icons. */
const MANIFEST_MARGIN = 0.06;

/** Fixed sizes of a catalogue entry, smallest first. The catalogue is the only source of sizes. */
function fixedSizes(specId: string): Size[] {
  const rule = getSpec(specId).dimensions;
  if (rule.kind !== 'fixed') throw new Error(`${specId} has no fixed sizes`);
  return [...rule.sizes].sort((a, b) => a.width - b.width);
}

/** Absolute path of the most recently changed uploaded logo. */
export async function newestLogo(workspace: Workspace): Promise<string> {
  const logos = (await listInputs(workspace)).filter((input) => input.kind === 'logo');
  if (logos.length === 0) throw new GeneratorError('Upload a logo first');
  const dated = [];
  for (const logo of logos) {
    const absolute = path.join(workspace.root, logo.path);
    const info = await lstat(absolute);
    // Only regular files: a link planted in a cloned workspace must not pull in a file from elsewhere.
    if (info.isFile()) dated.push({ absolute, modified: info.mtimeMs });
  }
  if (dated.length === 0) throw new GeneratorError('Upload a logo first');
  dated.sort((a, b) => a.modified - b.modified || a.absolute.localeCompare(b.absolute));
  return dated.at(-1)!.absolute;
}

/** icon.svg: rounded background that switches colour in dark mode, logo embedded as an image (never as markup). */
async function iconSvg(logo: LogoSource, light: HexColor, dark: HexColor): Promise<Buffer> {
  const data = logo.isSvg
    ? `data:image/svg+xml;base64,${logo.bytes.toString('base64')}`
    : `data:image/png;base64,${(await sharp(logo.bytes).autoOrient().resize(400, 400, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()).toString('base64')}`;
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
    `<style>.bg{fill:${light}}@media (prefers-color-scheme: dark){.bg{fill:${dark}}}</style>`,
    '<rect class="bg" width="512" height="512" rx="96"/>',
    `<image href="${data}" x="56" y="56" width="400" height="400" preserveAspectRatio="xMidYMid meet"/>`,
    '</svg>',
    '',
  ].join('\n');
  return Buffer.from(svg, 'utf8');
}

function webManifest(name: string, background: HexColor, theme: HexColor, iconSizes: Size[], maskable: Size): Buffer {
  const manifest = {
    name,
    short_name: name.length > 12 ? name.slice(0, 12).trim() : name,
    icons: [
      ...iconSizes.map((s) => ({ src: `/icon-${s.width}.png`, sizes: `${s.width}x${s.height}`, type: 'image/png' })),
      {
        src: `/icon-maskable-${maskable.width}.png`,
        sizes: `${maskable.width}x${maskable.height}`,
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    theme_color: theme,
    background_color: background,
    display: 'standalone',
  };
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function headSnippet(theme: HexColor, icoSize: Size): Buffer {
  return Buffer.from(
    [
      `<link rel="icon" href="/favicon.ico" sizes="${icoSize.width}x${icoSize.height}">`,
      '<link rel="icon" href="/icon.svg" type="image/svg+xml">',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
      '<link rel="manifest" href="/site.webmanifest">',
      `<meta name="theme-color" content="${theme}">`,
      '',
    ].join('\n'),
    'utf8',
  );
}

/** Checks every generated image against its catalogue entry before anything is written. */
async function assertValid(files: RegisterOptions[]): Promise<void> {
  for (const file of files) {
    const spec = getSpec(file.specId);
    if (spec.kind === 'document') continue;
    const violations = validateMedia(spec, await inspectImageBytes(file.bytes, `${file.name}.${file.extension}`));
    if (violations.length > 0) {
      throw new Error(`Generated ${file.name}.${file.extension} violates ${spec.id}: ${violations.map((v) => v.message).join('; ')}`);
    }
  }
}

/**
 * Generates the favicon and web app icon set from the newest uploaded logo into `web/shared/favicons/`.
 * All files are rendered and validated first and then registered together, so a failure leaves the previous set
 * untouched. Throws GeneratorError when no logo was uploaded or the logo cannot be read.
 */
export async function generateWebIcons(workspace: Workspace, options: WebIconOptions = {}): Promise<OutputEntry[]> {
  for (const [field, value] of Object.entries(options)) {
    if (value !== undefined && !isHexColor(value)) throw new GeneratorError(`${field} must be a colour like #1a2b3c`);
  }
  const background = options.background ?? '#ffffff';
  const dark = options.darkBackground ?? '#111111';
  const theme = options.themeColor ?? background;
  const project = await readProject(workspace);

  let logo: LogoSource;
  try {
    logo = await loadLogo(await newestLogo(workspace));
  } catch (error) {
    if (error instanceof GeneratorError) throw error;
    throw new GeneratorError('The uploaded logo cannot be read; upload it again as PNG, JPEG, WebP or SVG');
  }
  // Fail early with a clear message when an SVG would need an extreme resolution.
  if (logo.isSvg) svgDensity(logo, 512);

  const icoSizes = fixedSizes('web.favicon-ico');
  const [touch] = fixedSizes('web.apple-touch-icon');
  const manifestSizes = fixedSizes('web.manifest-icon');
  const maskableSpec = getSpec('web.maskable-icon');
  const [maskable] = fixedSizes('web.maskable-icon');
  if (!touch || !maskable || !maskableSpec.safeArea) throw new Error('Web icon specs are incomplete');
  const maskableBox = Math.floor(maskableSpec.safeArea.width / Math.SQRT2);

  const ico = encodeIco(
    await Promise.all(icoSizes.map(async ({ width }) => ({ size: width, png: await renderLogoSquare(logo, { size: width, logoBox: width }) }))),
  );

  const files: RegisterOptions[] = [
    { specId: 'web.favicon-ico', name: 'favicon', extension: 'ico', bytes: ico, order: 1 },
    { specId: 'web.icon-svg', name: 'icon', extension: 'svg', bytes: await iconSvg(logo, background, dark), order: 1 },
    {
      specId: 'web.apple-touch-icon',
      name: 'apple-touch-icon',
      extension: 'png',
      bytes: await renderLogoSquare(logo, { size: touch.width, logoBox: Math.round(touch.width * TOUCH_ARTWORK_RATIO), background }),
      order: 1,
    },
    ...(await Promise.all(
      manifestSizes.map(async ({ width }, index) => ({
        specId: 'web.manifest-icon',
        name: `icon-${width}`,
        extension: 'png',
        bytes: await renderLogoSquare(logo, { size: width, logoBox: Math.round(width * (1 - 2 * MANIFEST_MARGIN)) }),
        order: index + 1,
      })),
    )),
    {
      specId: 'web.maskable-icon',
      name: `icon-maskable-${maskable.width}`,
      extension: 'png',
      bytes: await renderLogoSquare(logo, { size: maskable.width, logoBox: maskableBox, background }),
      order: 1,
    },
    {
      specId: 'web.webmanifest',
      name: 'site',
      extension: 'webmanifest',
      bytes: webManifest(project.name, background, theme, manifestSizes, maskable),
      order: 1,
    },
    { specId: 'web.head-snippet', name: 'head', extension: 'html', bytes: headSnippet(theme, icoSizes.at(-1)!), order: 1 },
  ];

  await assertValid(files);
  return registerOutputs(workspace, files);
}
