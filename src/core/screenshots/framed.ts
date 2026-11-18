import sharp from 'sharp';
import { CardInputError, deviceSvg, screenshotInfo } from './device.js';
import { DEFAULT_SCREEN_ASPECT, SHADOW, isFrameKind, loadUserFrame, outerAspect, type FrameKind, type UserFrame } from './frames.js';

export interface FramedInput {
  screenshot: Uint8Array;
  frame: FrameKind;
  /** Outer width of the device (frame included) in pixels; the image adds a margin for the shadow. */
  deviceWidth: number;
  /** Soft drop shadow under the device (default true). */
  shadow?: boolean;
  /** A user bezel loaded once by the caller (null: none); takes precedence over `userFramesDir`. */
  userFrame?: UserFrame | null;
  /** Folder with user bezels (`<kind>.png` + `<kind>.json`), read when `userFrame` is not given. */
  userFramesDir?: string;
  /** Allowed edge lengths of the result (from the catalogue); checked before rendering, so oversized images fail fast. */
  edges?: { min: number; max: number };
}

/** Margin around the device for the shadow, as a share of the device width (blur reach plus offset). */
const SHADOW_MARGIN = SHADOW.blur * 3 + SHADOW.offset;
/** Safety bound of the renderer, not a store size: the catalogue limits the generated files. */
const MAX_DEVICE_WIDTH = 8192;

/**
 * Renders an app screenshot in a device frame on a transparent background, for websites: no card background, no text.
 * Returns an RGBA PNG; the caller converts it to other formats. The image is the device plus, with a shadow, a margin
 * that keeps the shadow uncut.
 */
export async function renderFramedScreenshot(input: FramedInput): Promise<Buffer> {
  if (!isFrameKind(input.frame)) throw new CardInputError(`Unknown frame: ${String(input.frame)}`);
  if (!Number.isInteger(input.deviceWidth) || input.deviceWidth < 1 || input.deviceWidth > MAX_DEVICE_WIDTH) {
    throw new CardInputError(`Device width must be whole pixels from 1 to ${MAX_DEVICE_WIDTH}`);
  }
  const shadow = input.shadow ?? true;
  const shot = await screenshotInfo(input.screenshot);
  const screenAspect = shot ? shot.height / shot.width : DEFAULT_SCREEN_ASPECT[input.frame];
  const userFrame =
    input.userFrame !== undefined ? input.userFrame : input.userFramesDir ? await loadUserFrame(input.userFramesDir, input.frame) : null;
  const aspect = userFrame ? userFrame.height / userFrame.width : outerAspect(input.frame, screenAspect);

  const margin = shadow ? Math.ceil(input.deviceWidth * SHADOW_MARGIN) : 0;
  const width = input.deviceWidth + 2 * margin;
  const height = Math.round(input.deviceWidth * aspect) + 2 * margin;
  if (input.edges && (Math.min(width, height) < input.edges.min || Math.max(width, height) > input.edges.max)) {
    throw new CardInputError(
      `The framed image would be ${width}×${height} px; allowed are ${input.edges.min} to ${input.edges.max} px per side (is the screenshot very tall or wide?)`,
    );
  }
  const device = await deviceSvg({
    kind: input.frame,
    userFrame,
    box: { x: margin, y: margin, width: input.deviceWidth },
    screenAspect,
    screenshot: input.screenshot,
    shadow,
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${device.svg}</svg>`;
  // `unlimited`: the SVG is built here and embeds the resized screenshot as a data URI.
  return sharp(Buffer.from(svg), { unlimited: true }).ensureAlpha().png().toBuffer();
}
