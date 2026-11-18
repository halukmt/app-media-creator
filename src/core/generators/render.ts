import { readFile } from 'node:fs/promises';
import sharp from 'sharp';

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

/**
 * Up to five main colours of the logo, most frequent first, as suggestions for background colours.
 * Transparent pixels are ignored; colours are grouped in steps of 16 per channel and reported as the group average.
 */
export async function logoPalette(logo: LogoSource, count = 5): Promise<HexColor[]> {
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, 64) }) : sharp(logo.bytes);
  const { data, info } = await input
    .autoOrient()
    .resize(64, 64, { fit: 'inside' })
    // Greyscale logos stay in the b-w colour space otherwise; the loop below expects RGBA.
    .toColourspace('srgb')
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
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

/**
 * Renders a one-colour silhouette of the logo: the logo's coverage filled with `color` on transparency, centred in
 * `logoBox` on a `size` square. Used for Android monochrome (themed) icons. For logos without transparency the
 * colour of the logo's top-left corner counts as background, so a logo on a white JPEG background still works.
 */
export async function renderSilhouette(logo: LogoSource, options: { size: number; logoBox: number; color: HexColor }): Promise<Buffer> {
  const placed = await renderLogoSquare(logo, { size: options.size, logoBox: options.logoBox });
  const { data, info } = await sharp(placed).raw().toBuffer({ resolveWithObject: true });
  const { isOpaque } = await sharp(logo.bytes).stats();
  if (isOpaque) {
    // The first covered pixel (top-left of the placed logo) gives the background colour.
    let first = 0;
    while (first < data.length && data[first + 3] === 0) first += 4;
    const [br, bg, bb] = [data[first] ?? 0, data[first + 1] ?? 0, data[first + 2] ?? 0];
    for (let i = 0; i < data.length; i += 4) {
      const distance = Math.abs(data[i]! - br) + Math.abs(data[i + 1]! - bg) + Math.abs(data[i + 2]! - bb);
      if (distance < BACKGROUND_TOLERANCE) data[i + 3] = 0;
    }
  }
  const alpha = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extractChannel('alpha')
    .png()
    .toBuffer();
  return sharp({ create: { width: options.size, height: options.size, channels: 3, background: options.color } })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}
