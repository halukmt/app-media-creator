import sharp from 'sharp';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { getSpec, type Size } from '../specs/index.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import type { Environment } from '../workspace/project.js';
import { ICON_SAFE_RADIUS, variantRenderer } from './environments.js';
import { GeneratorError, loadNewestLogo } from './logo.js';
import { assertValidOutputs, fixedSizes } from './outputs.js';
import { encodeIco, isHexColor, renderLogoSquare, type HexColor, type LogoSource } from './render.js';

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

/** icon.svg of an environment: the rendered variant embedded as a PNG inside the rounded square. */
function variantIconSvg(png: Buffer): Buffer {
  return Buffer.from(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
      '<clipPath id="r"><rect width="512" height="512" rx="96"/></clipPath>',
      `<image href="data:image/png;base64,${png.toString('base64')}" width="512" height="512" clip-path="url(#r)"/>`,
      '</svg>',
      '',
    ].join('\n'),
    'utf8',
  );
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

/**
 * Generates the favicon and web app icon set from the newest uploaded logo into `web/shared/favicons/`, and the same
 * set per non-production environment into `web/<environment>/favicons/` (for staging sites).
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

  const logo = await loadNewestLogo(workspace);

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

  for (const environment of project.environments) {
    files.push(...(await variantFiles(environment)));
  }

  await assertValidOutputs(files);
  // A full set per run: files of environments that were removed from the project go away.
  return registerOutputs(workspace, files, { replaceSets: { specIds: [...new Set(files.map((f) => f.specId))], locales: [undefined] } });

  async function variantFiles(environment: Environment): Promise<RegisterOptions[]> {
    const variant = variantRenderer(logo, environment);
    // The label of the maskable icon stays in the catalogue's safe zone (a circle of its width).
    const maskableRadius = maskableSpec.safeArea!.width / 2 / maskable!.width;
    const common = { environment: environment.id, order: 1 };
    const variantIco = encodeIco(
      await Promise.all(icoSizes.map(async ({ width }) => ({ size: width, png: await variant.standalone(width, width, ICON_SAFE_RADIUS) }))),
    );
    return [
      { ...common, specId: 'web.favicon-ico', name: 'favicon', extension: 'ico', bytes: variantIco },
      {
        ...common,
        specId: 'web.icon-svg',
        name: 'icon',
        extension: 'svg',
        bytes: variantIconSvg(await variant.opaque(512, 400, background, ICON_SAFE_RADIUS)),
      },
      {
        ...common,
        specId: 'web.apple-touch-icon',
        name: 'apple-touch-icon',
        extension: 'png',
        bytes: await variant.opaque(touch!.width, Math.round(touch!.width * TOUCH_ARTWORK_RATIO), background, ICON_SAFE_RADIUS),
      },
      ...(await Promise.all(
        manifestSizes.map(async ({ width }, index) => ({
          ...common,
          specId: 'web.manifest-icon',
          name: `icon-${width}`,
          extension: 'png',
          bytes: await variant.standalone(width, Math.round(width * (1 - 2 * MANIFEST_MARGIN)), ICON_SAFE_RADIUS),
          order: index + 1,
        })),
      )),
      {
        ...common,
        specId: 'web.maskable-icon',
        name: `icon-maskable-${maskable!.width}`,
        extension: 'png',
        bytes: await variant.opaque(maskable!.width, maskableBox, background, maskableRadius),
      },
      {
        ...common,
        specId: 'web.webmanifest',
        name: 'site',
        extension: 'webmanifest',
        bytes: webManifest(`${project.name} (${environment.badge})`, background, theme, manifestSizes, maskable!),
      },
      { ...common, specId: 'web.head-snippet', name: 'head', extension: 'html', bytes: headSnippet(theme, icoSizes.at(-1)!) },
    ];
  }
}
