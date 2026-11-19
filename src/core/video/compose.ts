import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { backgroundSvg, textColorFor, type Background } from '../screenshots/backgrounds.js';
import { frameBox, frameOverlaySvg, frameSvg, outerAspect, screenWidthFor, svgNumber as n, type FrameBox, type FrameKind } from '../screenshots/frames.js';
import { textBlockSvg, type TextWarning } from '../screenshots/text-block.js';
import type { Rect, Size } from '../specs/index.js';
import { PreviewError } from './preview.js';
import { FfmpegMissingError, ffmpegBinary, isMissingProgram, programMessage, renderProgram, type RunProgram } from './tools.js';

/**
 * Videos composed of layers (#21): a still plate (background, text, the device with its shadow), the recording scaled
 * into the device screen, and the frame drawn over it with the screen cut out. Used for the device videos for web and
 * social and for the App Store's looping header and search videos.
 */

export type EmbedFormat = 'vertical' | 'landscape' | 'square';
export const EMBED_FORMATS: readonly EmbedFormat[] = ['vertical', 'landscape', 'square'];
export const EMBED_SPECS: Record<EmbedFormat, string> = {
  vertical: 'web.video.vertical',
  landscape: 'web.video.landscape',
  square: 'web.video.square',
};

export function isEmbedFormat(value: unknown): value is EmbedFormat {
  return typeof value === 'string' && (EMBED_FORMATS as readonly string[]).includes(value);
}

/** Crossfade from the end of a loop into its start, in seconds: the last frame leads into the first. */
export const LOOP_FADE = 0.5;
/** Fade in and out of a device video, in seconds. */
const EMBED_FADE = 0.3;

export interface EmbedLayout {
  /** Outer box of the device and its frame geometry. */
  device: { x: number; y: number; width: number; height: number };
  frame: FrameBox;
  /** Box the text is fitted into, or null without text. */
  text: Rect | null;
  textSize: number;
  align: 'left' | 'center';
}

/**
 * Where text and device go in a device video. Vertical and square: text on top, the device below it. Landscape: text
 * on the left, the device on the right. Without text the device is centred and larger. Pure, so it is tested alone.
 */
export function embedLayout(format: EmbedFormat, size: Size, kind: FrameKind, screenAspect: number, hasText: boolean): EmbedLayout {
  const { width: W, height: H } = size;
  const aspect = outerAspect(kind, screenAspect);
  let area: Rect;
  let text: Rect | null = null;
  let textSize = 0;
  let align: 'left' | 'center' = 'center';
  if (format === 'landscape') {
    if (hasText) {
      text = { x: W * 0.06, y: H * 0.15, width: W * 0.44, height: H * 0.7 };
      textSize = H * 0.09;
      align = 'left';
      area = { x: W * 0.52, y: H * 0.08, width: W * 0.44, height: H * 0.84 };
    } else {
      area = { x: W * 0.05, y: H * 0.08, width: W * 0.9, height: H * 0.84 };
    }
  } else {
    const top = 0.05;
    const textHeight = format === 'vertical' ? 0.17 : 0.16;
    if (hasText) {
      text = { x: W * 0.08, y: H * top, width: W * 0.84, height: H * textHeight };
      textSize = W * (format === 'vertical' ? 0.075 : 0.065);
      area = { x: W * 0.08, y: H * (top + textHeight + 0.03), width: W * 0.84, height: H * (0.95 - top - textHeight - 0.03) };
    } else {
      area = { x: W * 0.08, y: H * 0.08, width: W * 0.84, height: H * 0.84 };
    }
  }
  let height = area.height;
  let width = height / aspect;
  if (width > area.width) {
    width = area.width;
    height = width * aspect;
  }
  const device = { x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height };
  const screenWidth = screenWidthFor(kind, width);
  return { device, frame: frameBox(kind, screenWidth, screenWidth * screenAspect), text, textSize, align };
}

/**
 * A screen rectangle in whole pixels: position rounded, size rounded up by one pixel so no gap opens next to the
 * frame. The overlay above covers the extra pixel.
 */
export function screenPixels(screen: Rect): Rect {
  return { x: Math.round(screen.x), y: Math.round(screen.y), width: Math.ceil(screen.width) + 1, height: Math.ceil(screen.height) + 1 };
}

/** Absolute screen rectangle of a device at `device` with frame geometry `frame`. */
export function deviceScreen(device: { x: number; y: number }, frame: FrameBox): Rect & { radius: number } {
  const s = frame.screen;
  return { x: device.x + s.x, y: device.y + s.y, width: s.width, height: s.height, radius: s.radius };
}

export interface Layers {
  plate: Buffer;
  overlay: Buffer;
  screen: Rect;
  warnings: TextWarning[];
}

const svgDoc = (size: Size, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">${body}</svg>`;

/** Renders the overlay SVG fragment on a transparent canvas of the output size. */
export async function overlayPng(size: Size, fragment: string): Promise<Buffer> {
  return sharp(Buffer.from(svgDoc(size, fragment)), { unlimited: true }).png().toBuffer();
}

/** Plate and overlay of a device video: background, text and device (with shadow) below, the frame on top. */
export async function renderEmbedLayers(input: {
  format: EmbedFormat;
  size: Size;
  kind: FrameKind;
  screenAspect: number;
  text: string;
  background: Background;
}): Promise<Layers> {
  const text = input.text.normalize('NFC').trim();
  const layout = embedLayout(input.format, input.size, input.kind, input.screenAspect, text.length > 0);
  const block = layout.text
    ? textBlockSvg({
        ...layout.text,
        title: text,
        titleSize: layout.textSize,
        subtitleSize: layout.textSize / 2,
        color: textColorFor(input.background),
        align: layout.align,
        valign: 'middle',
      })
    : null;
  const bg = backgroundSvg(input.background, input.size.width, input.size.height);
  const { x, y } = layout.device;
  const { width: W, height: H } = input.size;
  const device = frameSvg(input.kind, x, y, layout.frame, '', 'embed', true);
  const content = `<rect width="${W}" height="${H}" fill="${bg.fill}"/>${device}${block?.svg ?? ''}`;
  const plate = await sharp(Buffer.from(svgDoc(input.size, `<defs>${bg.defs}</defs>${content}`)), { unlimited: true }).removeAlpha().png().toBuffer();
  // The overlay is the whole plate with the rounded screen cut out (plus the cutouts on the screen): it hides the
  // square corners and the extra pixel of the video, also without a frame.
  const s = deviceScreen(layout.device, layout.frame);
  const hole =
    `<mask id="embed-hole" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>` +
    `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.width)}" height="${n(s.height)}" rx="${n(s.radius)}" fill="#000"/></mask>`;
  const overlay = await overlayPng(
    input.size,
    `<defs>${bg.defs}${hole}</defs><g mask="url(#embed-hole)">${content}</g>${frameOverlaySvg(input.kind, x, y, layout.frame, 'embed-overlay')}`,
  );
  return { plate, overlay, screen: screenPixels(s), warnings: block?.warnings ?? [] };
}

export interface LoopPlan {
  clipStart: number;
  clipSeconds: number;
  /** Length of the loop: the clip minus the crossfade that joins its end to its start. */
  totalSeconds: number;
  shortened: boolean;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export interface PlanInput {
  sourceSeconds: number;
  trim?: { start?: number; end?: number };
  minSeconds: number;
  maxSeconds: number;
}

/** Start and usable length of the trimmed recording; throws PreviewError for a trim outside it. */
function trimWindow(input: PlanInput): { start: number; available: number } {
  const start = input.trim?.start ?? 0;
  const end = Math.min(input.trim?.end ?? input.sourceSeconds, input.sourceSeconds);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 1) {
    throw new PreviewError(`The trim must lie inside the recording (0–${round(input.sourceSeconds)} s) and keep at least 1 s`);
  }
  return { start: round(start), available: end - start };
}

/** Part of the recording for a seamless loop of `minSeconds`–`maxSeconds`; throws PreviewError when it is too short. */
export function planLoop(input: PlanInput): LoopPlan {
  const { start, available } = trimWindow(input);
  const clipSeconds = round(Math.min(available, input.maxSeconds + LOOP_FADE));
  const totalSeconds = round(clipSeconds - LOOP_FADE);
  if (totalSeconds < input.minSeconds) {
    throw new PreviewError(`The loop would last ${totalSeconds} s; it needs ${input.minSeconds}–${input.maxSeconds} s. Use a longer recording or a wider trim.`);
  }
  return { clipStart: start, clipSeconds, totalSeconds, shortened: available > clipSeconds + 0.001 };
}

/** A device video: the trimmed recording, cut to the maximum; throws PreviewError when it is too short. */
export function planClip(input: PlanInput): LoopPlan {
  const { start, available } = trimWindow(input);
  const clipSeconds = round(Math.min(available, input.maxSeconds));
  if (clipSeconds < input.minSeconds) throw new PreviewError(`The video would last ${clipSeconds} s; it needs ${input.minSeconds}–${input.maxSeconds} s.`);
  return { clipStart: start, clipSeconds, totalSeconds: clipSeconds, shortened: available > clipSeconds + 0.001 };
}

export interface ComposeArgsInput {
  plate: string;
  overlay: string;
  source: string;
  screen: Rect;
  size: Size;
  fps: number;
  plan: LoopPlan;
  /** Join the end to the start with a crossfade (looping store videos); otherwise fade in and out. */
  loop: boolean;
  /** Keep the recording's audio as stereo AAC; otherwise the video has no audio track. */
  audio: boolean;
  output: string;
}

/** ffmpeg arguments: plate, recording in the screen, frame on top; one run, no shell. */
export function composeArgs(input: ComposeArgsInput): string[] {
  const { screen, plan, fps } = input;
  const filters = [
    `[1:v]scale=${screen.width}:${screen.height}:force_original_aspect_ratio=increase,crop=${screen.width}:${screen.height},setsar=1,fps=${fps},format=yuv420p[rec]`,
  ];
  let rec = '[rec]';
  if (input.loop) {
    filters.push(
      `[rec]split[ra][rb]`,
      `[ra]trim=start=${LOOP_FADE},setpts=PTS-STARTPTS[main]`,
      `[rb]trim=end=${LOOP_FADE},setpts=PTS-STARTPTS[head]`,
      `[main][head]xfade=transition=fade:duration=${LOOP_FADE}:offset=${round(plan.clipSeconds - 2 * LOOP_FADE)}[looped]`,
    );
    rec = '[looped]';
  }
  const fade = input.loop ? '' : `,fade=t=in:st=0:d=${EMBED_FADE},fade=t=out:st=${round(plan.totalSeconds - EMBED_FADE)}:d=${EMBED_FADE}`;
  filters.push(`[0:v]${rec}overlay=${screen.x}:${screen.y}:shortest=1[base]`, `[base][2:v]overlay=0:0:shortest=1,format=yuv420p${fade}[v]`);
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-loop',
    '1',
    '-framerate',
    String(fps),
    '-i',
    input.plate,
    // Only local files: a crafted upload (e.g. a playlist) must not make ffmpeg open other files or URLs.
    '-protocol_whitelist',
    'file',
    '-ss',
    String(plan.clipStart),
    '-t',
    String(plan.clipSeconds),
    '-i',
    input.source,
    '-loop',
    '1',
    '-framerate',
    String(fps),
    '-i',
    input.overlay,
  ];
  if (input.audio) {
    filters.push(
      `[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,afade=t=in:st=0:d=${EMBED_FADE},afade=t=out:st=${round(plan.totalSeconds - EMBED_FADE)}:d=${EMBED_FADE}[a]`,
    );
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[v]');
  if (input.audio) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2');
  else args.push('-an');
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-movflags',
    '+faststart',
    '-t',
    String(plan.totalSeconds),
    input.output,
  );
  return args;
}

/** Writes plate and overlay and encodes the video into `output`. Throws FfmpegMissingError without ffmpeg. */
export async function renderComposite(
  input: Omit<ComposeArgsInput, 'plate' | 'overlay'> & { layers: Pick<Layers, 'plate' | 'overlay'>; workDir: string },
  run: RunProgram = renderProgram,
  binary = ffmpegBinary(),
): Promise<void> {
  const plate = path.join(input.workDir, 'plate.png');
  const overlay = path.join(input.workDir, 'overlay.png');
  await writeFile(plate, input.layers.plate);
  await writeFile(overlay, input.layers.overlay);
  try {
    await run(binary, composeArgs({ ...input, plate, overlay }));
  } catch (error) {
    if (isMissingProgram(error)) throw new FfmpegMissingError(`ffmpeg was not found (${binary}); install ffmpeg or set FFMPEG_PATH`);
    throw new PreviewError(`ffmpeg could not render the video: ${programMessage(error)}`);
  }
}
