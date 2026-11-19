import sharp from 'sharp';
import type { Size, SpecEntry } from '../specs/index.js';
import { backgroundSvg, isBackground, textColorFor, type Background } from './backgrounds.js';
import {
  DEFAULT_SCREEN_ASPECT,
  frameForSpec,
  isFrameKind,
  loadUserFrame,
  outerAspect,
  svgNumber,
  type FrameKind,
  type UserFrame,
} from './frames.js';
import { LAYOUT_RATIOS, isCardLayout, placeCard, type CardLayout } from './layouts.js';
import { textBlockSvg } from './text-block.js';
import { CardInputError, deviceSvg, screenshotInfo } from './device.js';

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
  /** A user bezel loaded once by the caller (null: none); takes precedence over `userFramesDir`. */
  userFrame?: UserFrame | null;
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

const n = svgNumber;
/** Largest card edge in pixels; store sizes stay far below. */
const MAX_EDGE = 8192;

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
  const userFrame =
    input.userFrame !== undefined ? input.userFrame : input.userFramesDir ? await loadUserFrame(input.userFramesDir, input.frame) : null;
  const deviceAspect = userFrame ? userFrame.height / userFrame.width : outerAspect(input.frame, screenAspect);
  const place = placeCard(input.layout, width, height, deviceAspect);

  // Text: headline and subline centred in the layout's text box.
  const ratios = LAYOUT_RATIOS[input.layout];
  const text = textBlockSvg({
    ...place.text,
    title: input.headline,
    ...(input.subline ? { subtitle: input.subline } : {}),
    titleSize: width * ratios.headline,
    subtitleSize: width * ratios.subline,
    titleLeading: LEADING.headline,
    subtitleLeading: LEADING.subline,
    color: textColorFor(input.background),
    align: 'center',
  });
  warnings.push(...text.warnings);

  const textShare = (text.width * text.height) / (width * height);
  if (input.maxTextShare !== undefined && textShare > input.maxTextShare) {
    warnings.push({
      code: 'text-share',
      message: `The text covers ${Math.round(textShare * 100)} % of the image; the store asks for under ${Math.round(input.maxTextShare * 100)} %`,
    });
  }

  // Device and background
  const device = await deviceSvg({ kind: input.frame, userFrame, box: place.device, screenAspect, screenshot: input.screenshot });
  const bg = backgroundSvg(input.background, width, height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs>${bg.defs}</defs><rect width="${width}" height="${height}" fill="${bg.fill}"/>` +
    `${device.svg}${text.svg}</svg>`;

  // `unlimited`: the SVG is built here and embeds the (resized) screenshot as a large data URI.
  const png = await sharp(Buffer.from(svg), { unlimited: true }).removeAlpha().png().toBuffer();
  return { png, warnings };
}
