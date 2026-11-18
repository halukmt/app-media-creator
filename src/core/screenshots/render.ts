import sharp from 'sharp';
import type { Size, SpecEntry } from '../specs/index.js';
import { backgroundSvg, isBackground, textColorFor, type Background } from './backgrounds.js';
import { cardFont } from './fonts.js';
import {
  DEFAULT_SCREEN_ASPECT,
  frameBox,
  frameForSpec,
  frameSvg,
  isFrameKind,
  loadUserFrame,
  outerAspect,
  screenWidthFor,
  svgNumber,
  type FrameKind,
  type UserFrame,
} from './frames.js';
import { LAYOUT_RATIOS, isCardLayout, placeCard, type CardLayout } from './layouts.js';
import { fitText } from './text-layout.js';

export interface CardInput {
  /** Output size in pixels. */
  width: number;
  height: number;
  layout: CardLayout;
  headline: string;
  subline?: string;
  background: Background;
  frame: FrameKind;
  /** The app screenshot (PNG / JPEG / WebP bytes); a neutral placeholder is drawn without one. */
  screenshot?: Uint8Array;
  /** Folder with user bezels (`<kind>.png` + `<kind>.json`); a matching one replaces the generic frame. */
  userFramesDir?: string;
  /** Warn when the text block covers more than this share of the card (Google Play asks for under 20 %). */
  maxTextShare?: number;
}

export type CardWarningCode = 'text-overflow' | 'word-broken' | 'missing-glyphs' | 'text-share';

export interface CardWarning {
  code: CardWarningCode;
  message: string;
}

export interface CardResult {
  /** PNG without alpha channel, exactly `width` × `height`. */
  png: Buffer;
  warnings: CardWarning[];
}

const LEADING = { headline: 1.08, subline: 1.3 } as const;
/** Gap between headline and subline, as a share of the headline size. */
const GAP = 0.3;
/** Text never shrinks below this share of the layout's start size. */
const MIN_TEXT_SCALE = 0.5;
const PLACEHOLDER = '#e5e5ea';

const n = svgNumber;
/** Largest card edge in pixels; store sizes stay far below. */
const MAX_EDGE = 8192;
const SCREENSHOT_FORMATS = new Set(['png', 'jpeg', 'webp']);

/** Thrown for card input that cannot be rendered (bad layout, colour, size, screenshot format …). */
export class CardInputError extends Error {}

/** Checks every value that ends up in the SVG, so the function is safe to call with request data. */
function assertCardInput(input: CardInput): void {
  const edge = (value: number) => Number.isInteger(value) && value > 0 && value <= MAX_EDGE;
  if (!edge(input.width) || !edge(input.height)) throw new CardInputError(`Card size must be whole pixels up to ${MAX_EDGE}`);
  if (input.width >= input.height) throw new CardInputError('Landscape cards are not supported yet; use a portrait size');
  if (!isCardLayout(input.layout)) throw new CardInputError(`Unknown layout: ${String(input.layout)}`);
  if (!isFrameKind(input.frame)) throw new CardInputError(`Unknown frame: ${String(input.frame)}`);
  if (!isBackground(input.background)) throw new CardInputError('The background must be a #rrggbb colour or a gradient of two');
  if (typeof input.headline !== 'string' || (input.subline !== undefined && typeof input.subline !== 'string')) {
    throw new CardInputError('Headline and subline must be text');
  }
}

/** Size the card renderer uses for a screenshot spec: the first fixed size, or the catalogue's default size. */
export function cardSizeForSpec(spec: SpecEntry): Size {
  if (spec.dimensions.kind === 'fixed' && spec.dimensions.sizes[0]) return spec.dimensions.sizes[0];
  if (spec.defaultSize) return spec.defaultSize;
  throw new Error(`${spec.id} has no fixed size and no default size for rendering`);
}

/**
 * Card settings a screenshot spec implies: its render size, the default frame (none where the store discourages
 * frames, as Google Play does) and the text share limit.
 */
export function cardDefaultsForSpec(spec: SpecEntry): { width: number; height: number; frame: FrameKind; maxTextShare?: number } {
  return {
    ...cardSizeForSpec(spec),
    frame: spec.discouragesFrames ? 'none' : frameForSpec(spec.id),
    ...(spec.maxTextShare !== undefined ? { maxTextShare: spec.maxTextShare } : {}),
  };
}

async function screenshotInfo(bytes: Uint8Array | undefined): Promise<{ width: number; height: number } | null> {
  if (!bytes) return null;
  const metadata = await sharp(bytes).metadata();
  // Raster formats only: an SVG "screenshot" would be parsed by librsvg with its own references.
  if (!SCREENSHOT_FORMATS.has(metadata.format ?? '')) throw new CardInputError('The screenshot must be a PNG, JPEG or WebP image');
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) throw new Error('The screenshot has no readable size');
  return { width, height };
}

/** The screenshot resized to cover the screen rectangle, as an SVG image element. */
async function screenImage(bytes: Uint8Array | undefined, x: number, y: number, width: number, height: number): Promise<string> {
  if (!bytes) return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="${PLACEHOLDER}"/>`;
  const resized = await sharp(bytes)
    .autoOrient()
    .resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 1 })
    .toBuffer();
  return (
    `<image x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" preserveAspectRatio="none" ` +
    `href="data:image/png;base64,${resized.toString('base64')}"/>`
  );
}

/** Device drawing with either the user's bezel or the generic frame. */
async function deviceSvg(
  kind: FrameKind,
  userFrame: UserFrame | null,
  box: { x: number; y: number; width: number },
  screenAspect: number,
  screenshot: Uint8Array | undefined,
): Promise<{ svg: string; height: number }> {
  if (userFrame) {
    const scale = box.width / userFrame.width;
    const s = userFrame.screen;
    const image = await screenImage(screenshot, box.x + s.x * scale, box.y + s.y * scale, s.width * scale, s.height * scale);
    const bezel =
      `<image x="${n(box.x)}" y="${n(box.y)}" width="${n(box.width)}" height="${n(userFrame.height * scale)}" preserveAspectRatio="none" ` +
      `href="data:image/png;base64,${userFrame.png.toString('base64')}"/>`;
    return { svg: image + bezel, height: userFrame.height * scale };
  }
  const screenWidth = screenWidthFor(kind, box.width);
  const frame = frameBox(kind, screenWidth, screenWidth * screenAspect);
  const s = frame.screen;
  const image = await screenImage(screenshot, box.x + s.x, box.y + s.y, s.width, s.height);
  return { svg: frameSvg(kind, box.x, box.y, frame, image, 'device'), height: frame.outerHeight };
}

/**
 * Renders a store screenshot card: background, headline and subline fitted into the layout's text box, and the app
 * screenshot in a device frame. Text is drawn as paths, so the output is identical on every machine.
 */
export async function renderScreenshotCard(input: CardInput): Promise<CardResult> {
  assertCardInput(input);
  const { width, height } = input;
  const warnings: CardWarning[] = [];
  const shot = await screenshotInfo(input.screenshot);
  const screenAspect = shot ? shot.height / shot.width : DEFAULT_SCREEN_ASPECT[input.frame];
  const userFrame = input.userFramesDir ? await loadUserFrame(input.userFramesDir, input.frame) : null;
  const deviceAspect = userFrame ? userFrame.height / userFrame.width : outerAspect(input.frame, screenAspect);
  const place = placeCard(input.layout, width, height, deviceAspect);

  // Text
  const heavy = cardFont(800);
  const regular = cardFont(500);
  const ratios = LAYOUT_RATIOS[input.layout];
  // NFC: decomposed input (e.g. "s" + U+0327 from macOS) becomes the precomposed letters the font has.
  const headline = input.headline.normalize('NFC').trim();
  const subline = input.subline?.normalize('NFC').trim() || undefined;
  const fit = fitText({
    headline,
    ...(subline ? { subline } : {}),
    width: place.text.width,
    height: place.text.height,
    headlineSize: width * ratios.headline,
    sublineSize: width * ratios.subline,
    headlineLeading: LEADING.headline,
    sublineLeading: LEADING.subline,
    gap: GAP,
    minScale: MIN_TEXT_SCALE,
    measureHeadline: (text, size) => heavy.measure(text, size),
    measureSubline: (text, size) => regular.measure(text, size),
  });
  if (fit.overflow) warnings.push({ code: 'text-overflow', message: 'The text does not fit into its area even at the smallest size; shorten it' });
  if (fit.brokenWord) warnings.push({ code: 'word-broken', message: 'A word is too long for one line and was hyphenated; shorten it or add a line break' });
  const missing = [...new Set([...heavy.missing(headline), ...regular.missing(subline ?? '')])];
  if (missing.length > 0) warnings.push({ code: 'missing-glyphs', message: `These characters cannot be drawn: ${missing.join(' ')}` });

  const color = textColorFor(input.background);
  const textPaths: string[] = [];
  let lineTop = place.text.y;
  let blockWidth = 0;
  const drawLines = (lines: string[], size: number, leading: number, font: typeof heavy) => {
    for (const line of lines) {
      // Centre the glyph box (ascent to descent) inside the line box, and the line inside the text box.
      const baseline = lineTop + (leading * size - (font.ascent - font.descent) * size) / 2 + font.ascent * size;
      const lineWidth = font.measure(line, size);
      blockWidth = Math.max(blockWidth, lineWidth);
      textPaths.push(font.path(line, place.text.x + (place.text.width - lineWidth) / 2, baseline, size).path);
      lineTop += leading * size;
    }
  };
  drawLines(fit.headlineLines, fit.headlineSize, LEADING.headline, heavy);
  const headlineSvg = `<path fill="${color}" d="${textPaths.join('')}"/>`;
  textPaths.length = 0;
  if (fit.sublineLines.length > 0) {
    lineTop += GAP * fit.headlineSize;
    drawLines(fit.sublineLines, fit.sublineSize, LEADING.subline, regular);
  }
  const sublineSvg = textPaths.length > 0 ? `<path fill="${color}" fill-opacity="0.9" d="${textPaths.join('')}"/>` : '';

  const textShare = (blockWidth * fit.height) / (width * height);
  if (input.maxTextShare !== undefined && textShare > input.maxTextShare) {
    warnings.push({
      code: 'text-share',
      message: `The text covers ${Math.round(textShare * 100)} % of the image; the store asks for under ${Math.round(input.maxTextShare * 100)} %`,
    });
  }

  // Device and background
  const device = await deviceSvg(input.frame, userFrame, place.device, screenAspect, input.screenshot);
  const bg = backgroundSvg(input.background, width, height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs>${bg.defs}</defs><rect width="${width}" height="${height}" fill="${bg.fill}"/>` +
    `${device.svg}${headlineSvg}${sublineSvg}</svg>`;

  // `unlimited`: the SVG is built here and embeds the (resized) screenshot as a large data URI.
  const png = await sharp(Buffer.from(svg), { unlimited: true }).removeAlpha().png().toBuffer();
  return { png, warnings };
}
