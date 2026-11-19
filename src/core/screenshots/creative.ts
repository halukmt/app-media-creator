import sharp from 'sharp';
import type { Rect } from '../specs/index.js';
import { backgroundSvg, isBackground, textColorFor, type Background } from './backgrounds.js';
import { CardInputError, deviceSvg, screenshotInfo } from './device.js';
import { DEFAULT_SCREEN_ASPECT, SHADOW, outerAspect, svgNumber as n, type UserFrame } from './frames.js';
import { textBlockSvg, type TextWarning } from './text-block.js';

/**
 * App Store creative assets (product page header, search results, universal image): the key art (the phrase and one
 * device with the first screenshot) inside the art safe area, and the background across the whole image with a row of
 * devices of the same size on both sides, fading towards the edges, in the auxiliary art area the App Store may crop.
 */

export interface CreativeInput {
  /** Output size in pixels. */
  width: number;
  height: number;
  /** Art safe area in output pixels: all key art stays inside it. */
  safeArea: Rect;
  background: Background;
  /** One short phrase; empty draws the device alone, centred in the safe area. */
  phrase: string;
  /** Up to three screenshots: the first is the key art, the others fill the sides (the first is reused if missing). */
  screenshots: readonly Uint8Array[];
  /** A user bezel for the generic iPhone frame, or null. */
  userFrame: UserFrame | null;
}

export interface CreativeLayout {
  /** Box the phrase is fitted into (before `textShift`), or null without a phrase. */
  text: Rect | null;
  /** How far the drawn phrase moves right, so phrase and key device sit centred together (0 without a measure). */
  textShift: number;
  /** The key-art device: top-left corner and outer width. */
  device: { x: number; y: number; width: number; height: number };
  /** Devices in the auxiliary art area, nearest first on each side; they may be cut off at the image edge. */
  sides: { x: number; y: number; width: number; height: number; opacity: number }[];
  /** Start size of the phrase in pixels. */
  textSize: number;
}

/** Inner margin of the safe area, as a share of its height. */
const PADDING = 0.06;
/** Height of the key-art device as a share of the safe area height (inside the padding). */
const DEVICE_SHARE = 1;
/** Largest share of the safe area width the key-art device may take when a phrase sits next to it. */
const MAX_DEVICE_WIDTH = 0.38;
/** Gap between side devices (and to the safe area) as a share of the device width. */
const SIDE_GAP = 0.35;
/** Opacity of the nearest side device; each further one fades by FADE, down to MIN_OPACITY. */
const SIDE_OPACITY = 0.7;
const FADE = 0.2;
const MIN_OPACITY = 0.2;
/** Start size of the phrase: a share of the safe area height, but at most the text box width divided by this. */
const TEXT_SIZE = 0.17;
const TEXT_WIDTH_DIVISOR = 9;
const MAX_EDGE = 8192;
/** The shadow is blurred at this share of its size and scaled up: a blur filter at full size takes seconds per device. */
const SHADOW_SCALE = 0.25;
/** Corner radius of the shadow as a share of the device width (the generic iPhone frame uses 0.15). */
const SHADOW_RADIUS = 0.15;

/**
 * Drop shadow under a device, as an SVG image: a rounded rectangle blurred by sharp at a quarter of its size. Same
 * offset, blur and opacity as the frame's own shadow filter, which librsvg renders far too slowly at these sizes.
 */
async function shadowSvg(box: { x: number; y: number; width: number; height: number }): Promise<string> {
  const sigma = box.width * SHADOW.blur;
  const margin = sigma * 3;
  const outer = { x: box.x - margin, y: box.y + box.width * SHADOW.offset - margin, width: box.width + 2 * margin, height: box.height + 2 * margin };
  const w = Math.max(1, Math.round(outer.width * SHADOW_SCALE));
  const h = Math.max(1, Math.round(outer.height * SHADOW_SCALE));
  const m = margin * SHADOW_SCALE;
  const shape =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${n(m)}" y="${n(m)}" width="${n(w - 2 * m)}" height="${n(h - 2 * m)}" ` +
    `rx="${n(box.width * SHADOW_RADIUS * SHADOW_SCALE)}" fill="#000" fill-opacity="0.3"/></svg>`;
  const png = await sharp(Buffer.from(shape)).blur(Math.max(0.3, sigma * SHADOW_SCALE)).png().toBuffer();
  return (
    `<image x="${n(outer.x)}" y="${n(outer.y)}" width="${n(outer.width)}" height="${n(outer.height)}" preserveAspectRatio="none" ` +
    `href="data:image/png;base64,${png.toString('base64')}"/>`
  );
}

/**
 * Where everything goes, for a device of the given outer aspect (height / width). Pure, so the guarantee "key art
 * inside the safe area" can be tested without rendering. With `textWidth` (the measured width of the fitted phrase)
 * phrase and key device move towards each other by the space the phrase does not need, so they sit centred as a group.
 */
export function creativeLayout(width: number, height: number, safe: Rect, deviceAspect: number, hasText: boolean, textWidth?: number): CreativeLayout {
  const pad = safe.height * PADDING;
  const inner = { x: safe.x + pad, y: safe.y + pad, width: safe.width - 2 * pad, height: safe.height - 2 * pad };
  let deviceHeight = inner.height * DEVICE_SHARE;
  let deviceWidth = deviceHeight / deviceAspect;
  const maxWidth = inner.width * (hasText ? MAX_DEVICE_WIDTH : 1);
  if (deviceWidth > maxWidth) {
    deviceWidth = maxWidth;
    deviceHeight = deviceWidth * deviceAspect;
  }
  const deviceY = inner.y + (inner.height - deviceHeight) / 2;
  const text = hasText ? { x: inner.x, y: inner.y, width: inner.width - deviceWidth - pad, height: inner.height } : null;
  const textShift = text && textWidth !== undefined ? Math.max(0, (text.width - Math.min(textWidth, text.width)) / 2) : 0;
  const device = hasText
    ? { x: inner.x + inner.width - deviceWidth - textShift, y: deviceY, width: deviceWidth, height: deviceHeight }
    : { x: inner.x + (inner.width - deviceWidth) / 2, y: deviceY, width: deviceWidth, height: deviceHeight };

  // Side devices: the size of the key-art device, in a row outwards from the safe area on both sides.
  const sides: CreativeLayout['sides'] = [];
  const step = deviceWidth * (1 + SIDE_GAP);
  const gap = deviceWidth * SIDE_GAP;
  for (let k = 0; ; k += 1) {
    const left = safe.x - gap - deviceWidth - k * step;
    const right = safe.x + safe.width + gap + k * step;
    const opacity = Math.max(MIN_OPACITY, SIDE_OPACITY - k * FADE);
    const added = [left + deviceWidth > 0 ? left : null, right < width ? right : null].filter((x): x is number => x !== null);
    if (added.length === 0) break;
    for (const x of added) sides.push({ x, y: deviceY, width: deviceWidth, height: deviceHeight, opacity });
  }

  // Narrow safe areas (the universal image) get a smaller start size, so long words shrink instead of breaking.
  const textSize = Math.min(safe.height * TEXT_SIZE, text ? text.width / TEXT_WIDTH_DIVISOR : Infinity);
  return { text, textShift, device, sides, textSize };
}

/** Checks every value that ends up in the SVG, so the function is safe to call with request data. */
function assertCreativeInput(input: CreativeInput): void {
  const edge = (value: number) => Number.isInteger(value) && value > 0 && value <= MAX_EDGE;
  if (!edge(input.width) || !edge(input.height)) throw new CardInputError(`Image size must be whole pixels up to ${MAX_EDGE}`);
  const s = input.safeArea;
  const inside = [s.x, s.y, s.width, s.height].every(Number.isFinite) && s.x >= 0 && s.y >= 0 && s.width > 0 && s.height > 0;
  if (!inside || s.x + s.width > input.width || s.y + s.height > input.height) throw new CardInputError('The safe area must lie inside the image');
  if (!isBackground(input.background)) throw new CardInputError('The background must be a #rrggbb colour or a gradient of two');
  if (typeof input.phrase !== 'string') throw new CardInputError('The phrase must be text');
  if (input.screenshots.length === 0) throw new CardInputError('A creative asset needs at least one screenshot');
}

export interface CreativeResult {
  /** PNG without alpha channel, exactly `width` × `height`. */
  png: Buffer;
  warnings: TextWarning[];
}

/** Renders one creative asset; the text is drawn as paths, so the output is identical on every machine. */
export async function renderCreativeAsset(input: CreativeInput): Promise<CreativeResult> {
  assertCreativeInput(input);
  const { width, height, userFrame } = input;
  const shots = input.screenshots.slice(0, 3);
  // Every screenshot is checked (PNG, JPEG or WebP), not only the first: an SVG must never reach the renderer.
  const infos = await Promise.all(shots.map((shot) => screenshotInfo(shot)));
  const first = infos[0];
  const screenAspect = first ? first.height / first.width : DEFAULT_SCREEN_ASPECT.iphone;
  const deviceAspect = userFrame ? userFrame.height / userFrame.width : outerAspect('iphone', screenAspect);
  const phrase = input.phrase.normalize('NFC').trim();
  // The phrase is fitted into its box first; its measured width then centres phrase and key device as one group.
  const unshifted = creativeLayout(width, height, input.safeArea, deviceAspect, phrase.length > 0);
  const block = unshifted.text
    ? textBlockSvg({
        ...unshifted.text,
        title: phrase,
        titleSize: unshifted.textSize,
        subtitleSize: unshifted.textSize / 2,
        titleLeading: 1.1,
        color: textColorFor(input.background),
        align: 'left',
        valign: 'middle',
      })
    : null;
  const layout = block ? creativeLayout(width, height, input.safeArea, deviceAspect, true, block.width) : unshifted;

  const devices: string[] = [];
  const draw = async (box: { x: number; y: number; width: number; height: number }, screenshot: Uint8Array, id: string) => {
    // Own shadow below a device without the slow filter shadow.
    devices.push(await shadowSvg(box));
    devices.push((await deviceSvg({ kind: 'iphone', userFrame, box, screenAspect, screenshot, id, shadow: false })).svg);
  };
  // Side devices cycle through the other screenshots (the first one when it is the only one).
  const others = shots.length > 1 ? shots.slice(1) : shots;
  for (const [index, side] of layout.sides.entries()) {
    const start = devices.length;
    await draw(side, others[index % others.length]!, `side-${index}`);
    devices.splice(start, devices.length - start, `<g opacity="${n(side.opacity)}">${devices.slice(start).join('')}</g>`);
  }
  await draw(layout.device, shots[0]!, 'key');
  const text = block ? (layout.textShift > 0 ? `<g transform="translate(${n(layout.textShift)} 0)">${block.svg}</g>` : block.svg) : '';
  const warnings: TextWarning[] = block ? block.warnings : [];

  const bg = backgroundSvg(input.background, width, height);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs>${bg.defs}</defs><rect width="${width}" height="${height}" fill="${bg.fill}"/>${devices.join('')}${text}</svg>`;
  // `unlimited`: the SVG embeds the resized screenshots as large data URIs.
  const png = await sharp(Buffer.from(svg), { unlimited: true }).removeAlpha().png().toBuffer();
  return { png, warnings };
}
