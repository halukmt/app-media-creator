import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';

/**
 * Generic device frames, drawn as SVG around the screen. Neutral shapes only: no Apple or Google bezel artwork
 * (official bezels may not be redistributed). Users can drop official bezels into `frames/user/` instead.
 */
export type FrameKind = 'iphone' | 'iphone-home' | 'iphone-duo' | 'ipad' | 'android-phone' | 'android-tablet' | 'none';

export const FRAME_KINDS: readonly FrameKind[] = ['iphone', 'iphone-home', 'iphone-duo', 'ipad', 'android-phone', 'android-tablet', 'none'];

/** The frame that fits a screenshot spec; `none` for devices without a generic frame (Mac, TV, Watch, Chromebook …). */
export function frameForSpec(specId: string): FrameKind {
  const device = specId.replace(/^(apple|google)\.screenshot\./, '');
  if (specId.startsWith('apple.screenshot.')) {
    if (device.startsWith('iphone-duo')) return 'iphone-duo';
    if (['iphone-5.5', 'iphone-4.7', 'iphone-4.0', 'iphone-3.5'].includes(device)) return 'iphone-home';
    if (device.startsWith('iphone-')) return 'iphone';
    if (device.startsWith('ipad-')) return 'ipad';
  }
  if (specId === 'google.screenshot.phone') return 'android-phone';
  if (specId.startsWith('google.screenshot.tablet-')) return 'android-tablet';
  return 'none';
}

/** Screen aspect (height / width) used when no screenshot is given. */
export const DEFAULT_SCREEN_ASPECT: Record<FrameKind, number> = {
  iphone: 2556 / 1179,
  'iphone-home': 16 / 9,
  'iphone-duo': 2853 / 2007,
  ipad: 4 / 3,
  'android-phone': 20 / 9,
  'android-tablet': 16 / 10,
  none: 2556 / 1179,
};

interface Geometry {
  /** Side bezel as a share of the screen width. */
  side: number;
  /** Top and bottom bezel as a share of the screen width. */
  top: number;
  bottom: number;
  /** Outer corner radius as a share of the outer width. */
  radius: number;
  /** Screen corner radius as a share of the screen width. */
  screenRadius: number;
  cutout: 'island' | 'punch-hole' | 'home-button' | 'none';
}

const GEOMETRY: Record<Exclude<FrameKind, 'none'>, Geometry> = {
  iphone: { side: 0.036, top: 0.036, bottom: 0.036, radius: 0.15, screenRadius: 0.13, cutout: 'island' },
  'iphone-home': { side: 0.06, top: 0.24, bottom: 0.24, radius: 0.14, screenRadius: 0, cutout: 'home-button' },
  'iphone-duo': { side: 0.03, top: 0.03, bottom: 0.03, radius: 0.08, screenRadius: 0.06, cutout: 'punch-hole' },
  ipad: { side: 0.045, top: 0.045, bottom: 0.045, radius: 0.07, screenRadius: 0.035, cutout: 'none' },
  'android-phone': { side: 0.03, top: 0.03, bottom: 0.03, radius: 0.12, screenRadius: 0.1, cutout: 'punch-hole' },
  'android-tablet': { side: 0.04, top: 0.04, bottom: 0.04, radius: 0.06, screenRadius: 0.03, cutout: 'none' },
};

const BODY = '#0a0a0a';
/** Drop shadow offset and blur as shares of the outer width; also used to size the margin around framed screenshots. */
export const SHADOW = { offset: 0.025, blur: 0.035 } as const;
const RIM = '#2a2a2a';

export interface FrameBox {
  /** Outer size of the device including the frame. */
  outerWidth: number;
  outerHeight: number;
  /** Screen rectangle relative to the outer top-left corner. */
  screen: { x: number; y: number; width: number; height: number; radius: number };
}

/** Outer size and screen position of a frame around a screen of the given size. */
export function frameBox(kind: FrameKind, screenWidth: number, screenHeight: number): FrameBox {
  if (kind === 'none') {
    return {
      outerWidth: screenWidth,
      outerHeight: screenHeight,
      screen: { x: 0, y: 0, width: screenWidth, height: screenHeight, radius: screenWidth * 0.1 },
    };
  }
  const g = GEOMETRY[kind];
  const side = screenWidth * g.side;
  return {
    outerWidth: screenWidth + 2 * side,
    outerHeight: screenHeight + screenWidth * (g.top + g.bottom),
    screen: { x: side, y: screenWidth * g.top, width: screenWidth, height: screenHeight, radius: screenWidth * g.screenRadius },
  };
}

/** Screen width for a frame whose outer width is `outerWidth`. */
export function screenWidthFor(kind: FrameKind, outerWidth: number): number {
  return kind === 'none' ? outerWidth : outerWidth / (1 + 2 * GEOMETRY[kind].side);
}

/** Outer height divided by outer width for a screen with the given aspect (height / width). */
export function outerAspect(kind: FrameKind, screenAspect: number): number {
  const box = frameBox(kind, 1000, 1000 * screenAspect);
  return box.outerHeight / box.outerWidth;
}

/** A number for SVG markup: always a plain decimal, so nothing but digits reaches an attribute. */
export const svgNumber = (value: number) => (Number.isFinite(value) ? value.toFixed(2) : '0');
const n = svgNumber;

export function isFrameKind(value: unknown): value is FrameKind {
  return typeof value === 'string' && (FRAME_KINDS as readonly string[]).includes(value);
}

/**
 * SVG for a device at (x, y) with the screen content drawn by `screen` (SVG elements placed at the screen rectangle).
 * The body is drawn first, then the screen content clipped to the rounded screen, then cutouts on top.
 */
export function frameSvg(kind: FrameKind, x: number, y: number, box: FrameBox, screen: string, id: string, withShadow = true): string {
  const s = box.screen;
  const clip =
    `<clipPath id="${id}-screen"><rect x="${n(x + s.x)}" y="${n(y + s.y)}" width="${n(s.width)}" height="${n(s.height)}" ` +
    `rx="${n(s.radius)}"/></clipPath>`;
  const shadow = withShadow
    ? `<filter id="${id}-shadow" x="-20%" y="-20%" width="140%" height="140%">` +
      `<feDropShadow dx="0" dy="${n(box.outerWidth * SHADOW.offset)}" stdDeviation="${n(box.outerWidth * SHADOW.blur)}" flood-color="#000" flood-opacity="0.3"/></filter>`
    : '';
  const filter = withShadow ? ` filter="url(#${id}-shadow)"` : '';
  const content = `<g clip-path="url(#${id}-screen)">${screen}</g>`;

  if (kind === 'none') {
    const plate = `<rect x="${n(x)}" y="${n(y)}" width="${n(box.outerWidth)}" height="${n(box.outerHeight)}" rx="${n(s.radius)}" fill="#ffffff"${filter}/>`;
    return `<defs>${clip}${shadow}</defs>${plate}${content}`;
  }

  const g = GEOMETRY[kind];
  const radius = box.outerWidth * g.radius;
  const rim = Math.max(1, box.outerWidth * 0.006);
  const body =
    `<rect x="${n(x)}" y="${n(y)}" width="${n(box.outerWidth)}" height="${n(box.outerHeight)}" rx="${n(radius)}" fill="${BODY}"${filter}/>` +
    `<rect x="${n(x + rim / 2)}" y="${n(y + rim / 2)}" width="${n(box.outerWidth - rim)}" height="${n(box.outerHeight - rim)}" rx="${n(radius - rim / 2)}" fill="none" stroke="${RIM}" stroke-width="${n(rim)}"/>`;

  let cutout = '';
  const centreX = x + box.outerWidth / 2;
  if (g.cutout === 'island') {
    const w = s.width * 0.3;
    const h = s.width * 0.085;
    cutout = `<rect x="${n(centreX - w / 2)}" y="${n(y + s.y + s.width * 0.03)}" width="${n(w)}" height="${n(h)}" rx="${n(h / 2)}" fill="${BODY}"/>`;
  } else if (g.cutout === 'punch-hole') {
    const r = s.width * 0.022;
    cutout = `<circle cx="${n(centreX)}" cy="${n(y + s.y + s.width * 0.045)}" r="${n(r)}" fill="${BODY}"/>`;
  } else if (g.cutout === 'home-button') {
    const r = s.width * 0.075;
    const cy = y + s.y + s.height + (s.width * g.bottom) / 2;
    cutout = `<circle cx="${n(centreX)}" cy="${n(cy)}" r="${n(r)}" fill="none" stroke="${RIM}" stroke-width="${n(rim * 1.5)}"/>`;
  }
  return `<defs>${clip}${shadow}</defs>${body}${content}${cutout}`;
}

/** An official bezel the user placed in `frames/user/`: the PNG plus where its transparent screen area is. */
export interface UserFrame {
  png: Buffer;
  width: number;
  height: number;
  screen: { x: number; y: number; width: number; height: number };
}

const userFrameSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    screen: z.object({ x: z.number().min(0), y: z.number().min(0), width: z.number().positive(), height: z.number().positive() }),
  })
  .refine((f) => f.screen.x + f.screen.width <= f.width && f.screen.y + f.screen.height <= f.height, {
    message: 'the screen rectangle must lie inside width × height',
  });

/**
 * Loads `frames/user/<kind>.png` with its `<kind>.json` (`{ width, height, screen: { x, y, width, height } }` in PNG
 * pixels). Returns null when the user has not added one for this kind. Throws with the file name when the JSON is
 * broken or does not match the PNG.
 */
export async function loadUserFrame(dir: string, kind: FrameKind): Promise<UserFrame | null> {
  // `kind` becomes part of a file name: only the known kinds are ever looked up.
  if (!isFrameKind(kind) || kind === 'none') return null;
  const png = path.join(dir, `${kind}.png`);
  const json = path.join(dir, `${kind}.json`);
  if (!existsSync(png) || !existsSync(json)) return null;
  const label = `frames/user/${kind}.json`;
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(json, 'utf8'));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${(error as Error).message}`);
  }
  const parsed = userFrameSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${label} is invalid: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
  const bytes = await readFile(png);
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'png' || metadata.width !== parsed.data.width || metadata.height !== parsed.data.height) {
    throw new Error(`${label} says ${parsed.data.width}×${parsed.data.height}, but ${kind}.png is not a PNG of that size`);
  }
  return { png: bytes, ...parsed.data };
}
