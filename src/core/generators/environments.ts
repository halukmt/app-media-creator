import sharp from 'sharp';
import { cardFont, svgNumber as n, textColorFor } from '../screenshots/index.js';
import { ENVIRONMENT_COLORS, type Environment } from '../workspace/project.js';
import { renderLogoSquare, renderSilhouette, type HexColor, type LogoSource } from './render.js';

/**
 * Icon variants for non-production installs (preview, dev, beta), so testers never confuse them with the production app.
 *
 * - **badge:** the production icon with a label pill (e.g. PREVIEW) in the environment colour.
 * - **blueprint:** the logo outline in white on a blue gradient with grid lines, plus the label pill. Idea from
 *   blueprint by Mustafa Natur (MIT, macOS only); this is an own implementation with sharp, no code is copied.
 *
 * The label sits at the bottom centre inside a circle that stays visible under the platform masks (iOS rounded square,
 * Android circle or squircle), not in a corner: masks cut corners off. Below 64 px a label cannot be read; small icons
 * get a colour bar along the bottom edge instead.
 */

/** Radius of the visible circle as a share of the icon size, per kind of icon. */
export const SAFE_RADIUS = {
  /** App Store and touch icons, legacy launcher icons, manifest icons. */
  icon: 0.46,
  /** Android adaptive layers: the 66 dp safe zone of the 108 dp layer. */
  adaptive: 33 / 108,
  /** Maskable web icons: the inner 80 % circle. */
  maskable: 0.4,
} as const;

/** Icons smaller than this get a colour bar instead of a text label. */
const LABEL_MIN_SIZE = 64;
/** Cap height of Inter as a share of the font size, to centre upper-case text vertically. */
const CAP_HEIGHT = 0.727;

const BLUEPRINT = { from: '#0b3a8c', to: '#1d63c9', line: '#ffffff' } as const;

/** SVG elements of the environment label for an icon of `size` px whose visible circle has radius `radius` (share). */
export function badgeSvg(environment: Environment, size: number, radius: number): string {
  const color = ENVIRONMENT_COLORS[environment.color];
  if (size < LABEL_MIN_SIZE) {
    const height = Math.max(2, Math.round(size * 0.28));
    return `<rect x="0" y="${size - height}" width="${size}" height="${height}" fill="${color}"/>`;
  }
  const font = cardFont(800);
  const height = 0.3 * radius * size;
  const centerY = (0.5 + 0.62 * radius) * size;
  const maxWidth = 1.2 * radius * size;
  const padding = height * 0.45;
  let textSize = height * 0.6;
  const text = environment.badge;
  const measured = font.measure(text, textSize);
  if (measured + 2 * padding > maxWidth) textSize *= (maxWidth - 2 * padding) / measured;
  const textWidth = font.measure(text, textSize);
  const width = textWidth + 2 * padding;
  const x = (size - width) / 2;
  const textColor = textColorFor({ kind: 'solid', color });
  const run = font.path(text, (size - textWidth) / 2, centerY + (CAP_HEIGHT * textSize) / 2, textSize);
  return [
    `<rect x="${n(x)}" y="${n(centerY - height / 2)}" width="${n(width)}" height="${n(height)}" rx="${n(height / 2)}" fill="${color}"`,
    ` stroke="${textColor}" stroke-opacity="0.85" stroke-width="${n(Math.max(1, height * 0.06))}"/>`,
    `<path fill="${textColor}" d="${run.path}"/>`,
  ].join('');
}

async function withBadge(image: Buffer, environment: Environment, size: number, radius: number): Promise<Buffer> {
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${badgeSvg(environment, size, radius)}</svg>`);
  return sharp(image).composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
}

/** Blue gradient with a fine and a coarse grid, opaque. */
export async function blueprintBackground(size: number): Promise<Buffer> {
  const minor = size / 16;
  const lines: string[] = [];
  for (let i = 1; i < 16; i++) {
    const at = n(i * minor);
    const major = i % 4 === 0;
    const style = `stroke="${BLUEPRINT.line}" stroke-opacity="${major ? 0.24 : 0.1}" stroke-width="${n(Math.max(major ? 1 : 0.5, size / (major ? 256 : 512)))}"`;
    lines.push(`<line x1="${at}" y1="0" x2="${at}" y2="${size}" ${style}/>`, `<line x1="0" y1="${at}" x2="${size}" y2="${at}" ${style}/>`);
  }
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BLUEPRINT.from}"/><stop offset="1" stop-color="${BLUEPRINT.to}"/></linearGradient></defs>`,
    `<rect width="${size}" height="${size}" fill="url(#g)"/>`,
    ...lines,
    '</svg>',
  ].join('');
  return sharp(Buffer.from(svg)).removeAlpha().png().toBuffer();
}

/**
 * The logo as a white outline drawing on transparency: the edge of its silhouette drawn strongly, the inside faintly.
 * The edge is the silhouette minus its erosion (a blur that stays fully opaque only well inside the shape).
 */
export async function blueprintMark(logo: LogoSource, size: number, logoBox: number): Promise<Buffer> {
  const silhouette = await renderSilhouette(logo, { size, logoBox, color: '#ffffff' });
  const alpha = await sharp(silhouette).extractChannel('alpha').raw().toBuffer();
  const blurred = await sharp(alpha, { raw: { width: size, height: size, channels: 1 } })
    .blur(Math.max(0.5, size / 180))
    // sharp hands back sRGB after the blur; one channel keeps the indexes aligned with `alpha`.
    .extractChannel(0)
    .raw()
    .toBuffer();
  const out = Buffer.alloc(size * size);
  for (let i = 0; i < out.length; i++) {
    const inside = alpha[i]!;
    // 1 well inside the shape, 0 at and outside its edge.
    const depth = Math.min(1, Math.max(0, (blurred[i]! - 200) / 55));
    out[i] = Math.round(Math.max(inside * (1 - depth), inside * 0.18));
  }
  return sharp({ create: { width: size, height: size, channels: 3, background: BLUEPRINT.line } })
    .joinChannel(out, { raw: { width: size, height: size, channels: 1 } })
    .png()
    .toBuffer();
}

/** Renders the icon variants of one environment; the methods mirror the production renders of the generators. */
export interface VariantRenderer {
  /** Icon on an opaque background (store icon, legacy launcher, touch and maskable icons). No alpha channel. */
  opaque(size: number, logoBox: number, background: HexColor, radius: number): Promise<Buffer>;
  /** Artwork on transparency for layers and appearances that the platform puts on its own background. */
  transparent(size: number, logoBox: number, radius: number): Promise<Buffer>;
  /** Icon shown on any page background (favicons, manifest icons): transparent for badge, opaque for blueprint. */
  standalone(size: number, logoBox: number, radius: number): Promise<Buffer>;
  /** Background layer: the solid colour for badge, the blueprint background for blueprint. No alpha channel. */
  backgroundLayer(size: number, background: HexColor): Promise<Buffer>;
}

export function variantRenderer(logo: LogoSource, environment: Environment): VariantRenderer {
  const opaqueOnly = (png: Buffer) => sharp(png).removeAlpha().png().toBuffer();
  const solid = (size: number, background: HexColor) => sharp({ create: { width: size, height: size, channels: 3, background } }).png().toBuffer();

  if (environment.style === 'blueprint') {
    const square = async (size: number, logoBox: number, radius: number) => {
      const [background, mark] = await Promise.all([blueprintBackground(size), blueprintMark(logo, size, logoBox)]);
      const drawn = await sharp(background).composite([{ input: mark, left: 0, top: 0 }]).png().toBuffer();
      return opaqueOnly(await withBadge(drawn, environment, size, radius));
    };
    return {
      opaque: (size, logoBox, _background, radius) => square(size, logoBox, radius),
      transparent: async (size, logoBox, radius) => withBadge(await blueprintMark(logo, size, logoBox), environment, size, radius),
      standalone: (size, logoBox, radius) => square(size, logoBox, radius),
      backgroundLayer: (size) => blueprintBackground(size),
    };
  }

  const transparent = async (size: number, logoBox: number, radius: number) =>
    withBadge(await renderLogoSquare(logo, { size, logoBox }), environment, size, radius);
  return {
    opaque: async (size, logoBox, background, radius) =>
      opaqueOnly(await withBadge(await renderLogoSquare(logo, { size, logoBox, background }), environment, size, radius)),
    transparent,
    standalone: transparent,
    backgroundLayer: solid,
  };
}
