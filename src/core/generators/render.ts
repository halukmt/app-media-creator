import { readFile } from 'node:fs/promises';
import sharp, { type Sharp } from 'sharp';

/** A colour as `#rrggbb`. */
export type HexColor = `#${string}`;

const HEX = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is HexColor {
  return typeof value === 'string' && HEX.test(value);
}

export interface LogoSource {
  /** Raw file bytes of the uploaded logo. */
  bytes: Buffer;
  isSvg: boolean;
  /** Intrinsic size (SVG: at 72 dpi). */
  width: number;
  height: number;
}

/**
 * Reads a logo file; SVG is detected by content, not by extension. Decodes it once completely, so a truncated or
 * corrupt file fails here and not later in a generator. Throws for unreadable images.
 */
export async function loadLogo(filePath: string): Promise<LogoSource> {
  const bytes = await readFile(filePath);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error('The logo has no readable size');
  // Displayed size: JPEGs with an EXIF orientation store their pixels rotated.
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  const logo: LogoSource = { bytes, isSvg: metadata.format === 'svg', width, height };
  // At the lowest density (1 dpi) an SVG is rendered at a 72nd of its declared size; beyond this it cannot be bounded.
  if (logo.isSvg && Math.max(width, height) / 72 > MAX_SVG_RASTER) throw new Error('The SVG logo declares a canvas that is too large');
  // SVGs are decoded at the resolution of the largest icon, not at their (possibly huge) declared size.
  await (logo.isSvg ? sharp(bytes, { density: svgDensity(logo, DECODE_CHECK_BOX) }) : sharp(bytes)).stats();
  return logo;
}

/** Box used for the one-time decode check of SVG logos (the largest icon box rendered from a logo). */
const DECODE_CHECK_BOX = 1024;
/** Largest edge (px) an SVG may reach at the lowest density; larger declared canvases are rejected. */
const MAX_SVG_RASTER = 8192;

/** Density that rasterizes an SVG just large enough for `box` pixels (sharp's SVG base density is 72 dpi). */
export function svgDensity(logo: LogoSource, box: number): number {
  const scale = box / Math.max(logo.width, logo.height);
  return Math.min(2400, Math.max(1, Math.ceil(72 * scale * 1.25)));
}

export interface SquareOptions {
  /** Edge length of the output in pixels. */
  size: number;
  /** Edge length of the box the logo is fitted into (centred). */
  logoBox: number;
  /** Flat background colour, or undefined for a transparent background. */
  background?: HexColor;
  /** Render the logo in grey tones (transparency is kept). */
  grayscale?: boolean;
}

/**
 * Renders the logo centred on a square canvas: fitted into `logoBox` keeping its aspect ratio,
 * on a flat colour (no alpha channel in the output) or on transparency.
 */
export async function renderLogoSquare(logo: LogoSource, options: SquareOptions): Promise<Buffer> {
  const { size, logoBox, background, grayscale } = options;
  // Rasterize SVG slightly above the box size, so edges stay sharp without huge intermediate images.
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, logoBox) }) : sharp(logo.bytes);
  let pipeline = input.autoOrient().resize(logoBox, logoBox, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (grayscale) pipeline = pipeline.greyscale();
  const fitted = await pipeline.png().toBuffer();
  const offset = Math.round((size - logoBox) / 2);
  const canvas = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: fitted, left: offset, top: offset }]);
  return background ? canvas.flatten({ background }).removeAlpha().png().toBuffer() : canvas.png().toBuffer();
}

/** Builds an ICO file that stores each PNG as one 32-bit image (PNG-in-ICO, supported by every current browser). */
export function encodeIco(images: { size: number; png: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const directory = Buffer.alloc(16 * images.length);
  let offset = 6 + directory.length;
  images.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory.writeUInt8(size >= 256 ? 0 : size, at);
    directory.writeUInt8(size >= 256 ? 0 : size, at + 1);
    directory.writeUInt8(0, at + 2); // no palette
    directory.writeUInt8(0, at + 3); // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, directory, ...images.map((image) => image.png)]);
}

/** 8-bit RGBA pixels of an image, with its size. */
export interface RgbaPixels {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Reads the output of a sharp pipeline as 8-bit sRGB with alpha, 4 bytes per pixel, whatever the colour space and
 * depth of the input (greyscale, 16-bit). Every pixel loop over logo rasters reads through this helper; it throws if
 * the buffer does not have that layout, instead of letting a loop read the wrong bytes.
 */
export async function readRgba(pipeline: Sharp): Promise<RgbaPixels> {
  const { data, info } = await pipeline.toColourspace('srgb').ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true });
  if (info.channels !== 4 || data.length !== info.width * info.height * 4) {
    throw new Error(`Expected 8-bit RGBA pixels, got ${info.channels} channels and ${data.length} bytes for ${info.width}×${info.height}`);
  }
  return { data, width: info.width, height: info.height };
}

/**
 * Up to five main colours of the logo, most frequent first, as suggestions for background colours.
 * Transparent pixels are ignored; colours are grouped in steps of 16 per channel and reported as the group average.
 */
export async function logoPalette(logo: LogoSource, count = 5): Promise<HexColor[]> {
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, 64) }) : sharp(logo.bytes);
  const { data } = await readRgba(input.autoOrient().resize(64, 64, { fit: 'inside' }));
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
    if (a < 128) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return [...buckets.values()]
    .sort((x, y) => y.n - x.n)
    .slice(0, count)
    .map((c) => `#${hex(c.r / c.n)}${hex(c.g / c.n)}${hex(c.b / c.n)}` as HexColor);
}

/**
 * Rasterizes the logo once into a PNG whose longer side is `box` pixels, for generators that render many sizes:
 * every later render works on this small raster instead of decoding the source again.
 */
export async function rasterizeLogo(logo: LogoSource, box: number): Promise<LogoSource> {
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, box) }) : sharp(logo.bytes);
  const { data, info } = await input
    .autoOrient()
    .resize(box, box, { fit: 'inside', withoutEnlargement: !logo.isSvg })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { bytes: data, isSvg: false, width: info.width, height: info.height };
}

/** Colour distance below which a pixel of an opaque logo counts as its background. */
const BACKGROUND_TOLERANCE = 48;
/** Size the source logo is analysed at, once per logo, to decide whether it has a background to cut out. */
const ANALYSIS_BOX = 512;
/**
 * Share of the border pixels that must have one corner's colour for it to count as a background. Below 1, so a mark
 * that touches the edge (a tightly cropped wordmark) still has its background cut out.
 */
const BORDER_AGREEMENT = 0.6;
/** Tighter colour distance for the border check: a background is one flat colour, not a gentle gradient. */
const BORDER_TOLERANCE = 24;
/** Share of all pixels that must differ from the background; below it the logo is that one colour and stays whole. */
const MIN_MARK_SHARE = 0.001;

type Rgb = readonly [number, number, number];

function colourDistance(data: Buffer, index: number, colour: Rgb): number {
  return Math.abs(data[index]! - colour[0]) + Math.abs(data[index + 1]! - colour[1]) + Math.abs(data[index + 2]! - colour[2]);
}

/** Byte offsets of the border pixels of a `width`×`height` RGBA raster (each pixel once). */
function borderOffsets(width: number, height: number): number[] {
  const offsets: number[] = [];
  for (let x = 0; x < width; x += 1) {
    offsets.push(x * 4);
    if (height > 1) offsets.push(((height - 1) * width + x) * 4);
  }
  for (let y = 1; y < height - 1; y += 1) {
    offsets.push(y * width * 4);
    if (width > 1) offsets.push((y * width + width - 1) * 4);
  }
  return offsets;
}

/**
 * The background colour of an opaque logo, or null when there is nothing to cut out: the logo has transparency, its
 * border is not one flat colour (a gradient or photo mark), or it is that one colour throughout (a filled mark).
 * The candidate is the corner colour most of the border shares, so one noisy or decorated corner does not decide.
 */
async function analyseBackground(logo: LogoSource): Promise<Rgb | null> {
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, ANALYSIS_BOX) }) : sharp(logo.bytes);
  const { data, width, height } = await readRgba(
    input.autoOrient().resize(ANALYSIS_BOX, ANALYSIS_BOX, { fit: 'inside', withoutEnlargement: !logo.isSvg }),
  );
  const border = borderOffsets(width, height);
  const corners = [0, width - 1, (height - 1) * width, height * width - 1].map((pixel): Rgb => [data[pixel * 4]!, data[pixel * 4 + 1]!, data[pixel * 4 + 2]!]);
  let background: Rgb | null = null;
  let best = 0;
  for (const corner of corners) {
    const agreeing = border.filter((offset) => colourDistance(data, offset, corner) < BORDER_TOLERANCE).length;
    if (agreeing > best) [background, best] = [corner, agreeing];
  }
  if (!background || best < border.length * BORDER_AGREEMENT) return null;
  // One pass for both: any transparency means the alpha already is the coverage; the mark must not be empty.
  let mark = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 255) return null;
    if (colourDistance(data, i, background) >= BACKGROUND_TOLERANCE) mark += 1;
  }
  return mark >= width * height * MIN_MARK_SHARE ? background : null;
}

/** One analysis per logo source, shared by every size and variant rendered from it. */
const backgrounds = new WeakMap<Buffer, Promise<Rgb | null>>();

function logoBackground(logo: LogoSource): Promise<Rgb | null> {
  let background = backgrounds.get(logo.bytes);
  if (!background) {
    background = analyseBackground(logo);
    // A failed analysis is not kept, so a later render can try again.
    background.catch(() => backgrounds.delete(logo.bytes));
    backgrounds.set(logo.bytes, background);
  }
  return background;
}

/**
 * Renders a one-colour silhouette of the logo: the logo's coverage filled with `color` on transparency, centred in
 * `logoBox` on a `size` square. Used for Android monochrome (themed) icons, the web logo variants and blueprint icons.
 * For an opaque logo whose border is one colour (a mark on a white JPEG background) that colour is cut out; the
 * decision is made once per logo, so every size gives the same shape. Any other opaque logo keeps its full coverage.
 */
export async function renderSilhouette(logo: LogoSource, options: { size: number; logoBox: number; color: HexColor }): Promise<Buffer> {
  const placed = await renderLogoSquare(logo, { size: options.size, logoBox: options.logoBox });
  const { data, width, height } = await readRgba(sharp(placed));
  const background = await logoBackground(logo);
  if (background) {
    for (let i = 0; i < data.length; i += 4) if (colourDistance(data, i, background) < BACKGROUND_TOLERANCE) data[i + 3] = 0;
  }
  const alpha = await sharp(data, { raw: { width, height, channels: 4 } })
    .extractChannel('alpha')
    .png()
    .toBuffer();
  return sharp({ create: { width: options.size, height: options.size, channels: 3, background: options.color } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}
