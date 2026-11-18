import sharp from 'sharp';
import { frameBox, frameSvg, screenWidthFor, svgNumber as n, type FrameKind, type UserFrame } from './frames.js';

/** Thrown for screenshot input that cannot be rendered (bad layout, colour, size, screenshot format …). */
export class CardInputError extends Error {}

const SCREENSHOT_FORMATS = new Set(['png', 'jpeg', 'webp']);
const PLACEHOLDER = '#e5e5ea';

/** Displayed size of a screenshot; accepts raster formats only (an SVG would be parsed by librsvg with its references). */
export async function screenshotInfo(bytes: Uint8Array | undefined): Promise<{ width: number; height: number } | null> {
  if (!bytes) return null;
  const metadata = await sharp(bytes).metadata();
  if (!SCREENSHOT_FORMATS.has(metadata.format ?? '')) throw new CardInputError('The screenshot must be a PNG, JPEG or WebP image');
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!width || !height) throw new CardInputError('The screenshot has no readable size');
  return { width, height };
}

/** The screenshot resized to cover the screen rectangle, as an SVG image element; a grey placeholder without one. */
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

export interface DeviceOptions {
  kind: FrameKind;
  userFrame: UserFrame | null;
  /** Top-left corner and outer width of the device. */
  box: { x: number; y: number; width: number };
  /** Screen height / width. */
  screenAspect: number;
  screenshot: Uint8Array | undefined;
  /** Drop shadow under the generic frame (default true). */
  shadow?: boolean;
}

/** SVG of a device with the screenshot on its screen: the user's bezel if given, otherwise the generic frame. */
export async function deviceSvg(options: DeviceOptions): Promise<{ svg: string; height: number }> {
  const { kind, userFrame, box, screenAspect, screenshot } = options;
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
  return { svg: frameSvg(kind, box.x, box.y, frame, image, 'device', options.shadow ?? true), height: frame.outerHeight };
}
