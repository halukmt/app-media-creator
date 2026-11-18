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

/** Reads a logo file; SVG is detected by content, not by extension. Throws for unreadable images. */
export async function loadLogo(filePath: string): Promise<LogoSource> {
  const bytes = await readFile(filePath);
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error('The logo has no readable size');
  // Displayed size: JPEGs with an EXIF orientation store their pixels rotated.
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  return { bytes, isSvg: metadata.format === 'svg', width, height };
}

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
}

/**
 * Renders the logo centred on a square canvas: fitted into `logoBox` keeping its aspect ratio,
 * on a flat colour (no alpha channel in the output) or on transparency.
 */
export async function renderLogoSquare(logo: LogoSource, options: SquareOptions): Promise<Buffer> {
  const { size, logoBox, background } = options;
  // Rasterize SVG slightly above the box size, so edges stay sharp without huge intermediate images.
  const input = logo.isSvg ? sharp(logo.bytes, { density: svgDensity(logo, logoBox) }) : sharp(logo.bytes);
  const fitted = await input
    .autoOrient()
    .resize(logoBox, logoBox, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
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
