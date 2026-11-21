import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { backgroundSvg, textColorFor, type Background } from '../screenshots/backgrounds.js';
import { textBlockSvg, type TextWarning } from '../screenshots/text-block.js';
import type { Size } from '../specs/index.js';
import { FfmpegMissingError, ffmpegBinary, isMissingProgram, programMessage, encoderThreadArgs, renderProgram, x264Preset, type RunProgram } from './tools.js';

/**
 * App Store preview videos (#20): a real screen recording, trimmed, scaled and padded to the store size, with simple
 * fades and optional text cards before and after it. No effects that could suggest functions the app does not have.
 * Apple: 15–30 s, H.264 up to 30 fps at 10–12 Mbps, stereo AAC (a silent track when the recording has none).
 */

/** Fade in and out of each part, in seconds. */
export const FADE_SECONDS = 0.3;
export const CARD_SECONDS = { default: 2, min: 1, max: 5 } as const;

export class PreviewError extends Error {}

export interface PreviewPlanInput {
  /** Length of the source recording in seconds. */
  sourceSeconds: number;
  /** Part of the recording to use; defaults to all of it. */
  trim?: { start?: number; end?: number };
  intro: boolean;
  outro: boolean;
  cardSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

export interface PreviewPlan {
  clipStart: number;
  clipSeconds: number;
  introSeconds: number;
  outroSeconds: number;
  totalSeconds: number;
  /** The recording was cut at the end to stay within the maximum length. */
  shortened: boolean;
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/**
 * Decides which part of the recording goes into the preview. The cards keep their length; the recording is cut at the
 * end when the total would exceed the maximum. Throws PreviewError when the preview would be shorter than the minimum.
 */
export function planPreview(input: PreviewPlanInput): PreviewPlan {
  const { sourceSeconds, minSeconds, maxSeconds } = input;
  if (!Number.isFinite(input.cardSeconds) || input.cardSeconds < CARD_SECONDS.min || input.cardSeconds > CARD_SECONDS.max) {
    throw new PreviewError(`Text cards last ${CARD_SECONDS.min}–${CARD_SECONDS.max} s`);
  }
  const start = input.trim?.start ?? 0;
  const end = input.trim?.end ?? sourceSeconds;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > sourceSeconds + 0.05 || end - start < 1) {
    throw new PreviewError(`The trim must lie inside the recording (0–${round(sourceSeconds)} s) and keep at least 1 s`);
  }
  const introSeconds = input.intro ? input.cardSeconds : 0;
  const outroSeconds = input.outro ? input.cardSeconds : 0;
  const available = Math.min(end, sourceSeconds) - start;
  const room = maxSeconds - introSeconds - outroSeconds;
  const clipSeconds = round(Math.min(available, room));
  const totalSeconds = round(introSeconds + clipSeconds + outroSeconds);
  if (totalSeconds < minSeconds) {
    throw new PreviewError(
      `The preview would last ${totalSeconds} s; the App Store needs ${minSeconds}–${maxSeconds} s. Use a longer recording, a wider trim or text cards.`,
    );
  }
  return { clipStart: round(start), clipSeconds, introSeconds, outroSeconds, totalSeconds, shortened: available > room + 0.001 };
}

/** The store size in the recording's orientation: a landscape recording gets the landscape size. */
export function orientedSize(portrait: Size, source: { width: number; height: number }): Size {
  const landscape = source.width > source.height;
  const [short, long] = portrait.width <= portrait.height ? [portrait.width, portrait.height] : [portrait.height, portrait.width];
  return landscape ? { width: long, height: short } : { width: short, height: long };
}

export interface PreviewArgsInput {
  plan: PreviewPlan;
  source: string;
  sourceHasAudio: boolean;
  introCard?: string;
  outroCard?: string;
  size: Size;
  /** Output frame rate: the catalogue's maximum for the entry. */
  fps: number;
  /** Colour of the bars when the recording does not fill the store size (`#rrggbb`). */
  padColor: string;
  output: string;
}

/**
 * ffmpeg arguments for the preview: every part is scaled into the store size (padded, never cropped), set to 30 fps
 * and faded in and out, then the parts are concatenated with their audio (the recording's own, or silence).
 */
export function previewArgs(input: PreviewArgsInput): string[] {
  const { plan, size } = input;
  const W = size.width;
  const H = size.height;
  const pad = `0x${input.padColor.replace('#', '')}`;
  const args = ['-hide_banner', '-loglevel', 'error', '-y'];
  const filters: string[] = [];
  const parts: string[] = [];
  let index = 0;

  const fade = (seconds: number) => {
    const d = Math.min(FADE_SECONDS, seconds / 4);
    return `fade=t=in:st=0:d=${d},fade=t=out:st=${round(seconds - d)}:d=${d}`;
  };
  const videoChain = (label: string, seconds: number) =>
    `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${pad},setsar=1,fps=${input.fps},format=yuv420p,${fade(seconds)}[${label}]`;
  const silence = (seconds: number, label: string) => {
    args.push('-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=r=48000:cl=stereo');
    filters.push(`[${index}:a]asetpts=N/SR/TB[${label}]`);
    index += 1;
  };
  const card = (file: string, seconds: number, name: string) => {
    args.push('-loop', '1', '-framerate', String(input.fps), '-t', String(seconds), '-i', file);
    filters.push(`[${index}:v]${videoChain(`${name}v`, seconds)}`);
    index += 1;
    silence(seconds, `${name}a`);
    parts.push(`[${name}v][${name}a]`);
  };

  if (input.introCard && plan.introSeconds > 0) card(input.introCard, plan.introSeconds, 'intro');

  // Only local files: a crafted upload (e.g. a playlist) must not make ffmpeg open other files or URLs.
  args.push('-protocol_whitelist', 'file', '-ss', String(plan.clipStart), '-t', String(plan.clipSeconds), '-i', input.source);
  const clip = index;
  index += 1;
  filters.push(`[${clip}:v]${videoChain('clipv', plan.clipSeconds)}`);
  if (input.sourceHasAudio) {
    const d = Math.min(FADE_SECONDS, plan.clipSeconds / 4);
    filters.push(
      `[${clip}:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=0:${plan.clipSeconds},asetpts=N/SR/TB,afade=t=in:st=0:d=${d},afade=t=out:st=${round(plan.clipSeconds - d)}:d=${d}[clipa]`,
    );
  } else {
    silence(plan.clipSeconds, 'clipa');
  }
  parts.push('[clipv][clipa]');

  if (input.outroCard && plan.outroSeconds > 0) card(input.outroCard, plan.outroSeconds, 'outro');

  filters.push(`${parts.join('')}concat=n=${parts.length}:v=1:a=1[v][a]`);
  args.push(
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-c:v',
    'libx264',
    // veryfast by default (x264Preset): a local tool should not keep the user waiting; at a constant 11 Mbps the quality stays high.
    '-preset',
    x264Preset(),
    ...encoderThreadArgs(),
    '-profile:v',
    'high',
    '-level:v',
    '4.0',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(input.fps),
    // Constant 11 Mbps: Apple asks for 10–12 Mbps, also for calm footage that x264 would otherwise encode smaller.
    '-b:v',
    '11M',
    '-minrate',
    '11M',
    '-maxrate',
    '11M',
    '-bufsize',
    '22M',
    '-x264-params',
    'nal-hrd=cbr',
    '-g',
    String(input.fps * 2),
    '-c:a',
    'aac',
    '-b:a',
    '256k',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-movflags',
    '+faststart',
    '-t',
    String(plan.totalSeconds),
    input.output,
  );
  return args;
}

export interface TextCardInput {
  size: Size;
  text: string;
  background: Background;
}

/** A text card: one short localized line, centred on the background, drawn as paths with the bundled font. */
export async function renderTextCard(input: TextCardInput): Promise<{ png: Buffer; warnings: TextWarning[] }> {
  const { width, height } = input.size;
  const portrait = height >= width;
  const titleSize = Math.round((portrait ? width : height) * 0.085);
  const block = textBlockSvg({
    x: width * 0.1,
    y: height * (portrait ? 0.3 : 0.2),
    width: width * 0.8,
    height: height * (portrait ? 0.4 : 0.6),
    title: input.text,
    titleSize,
    subtitleSize: Math.round(titleSize * 0.6),
    color: textColorFor(input.background),
    align: 'center',
    valign: 'middle',
  });
  const fill = backgroundSvg(input.background, width, height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>${fill.defs}</defs><rect width="${width}" height="${height}" fill="${fill.fill}"/>${block.svg}</svg>`;
  const png = await sharp(Buffer.from(svg)).flatten({ background: '#000000' }).png().toBuffer();
  return { png, warnings: block.warnings };
}

/** Writes the cards and encodes the preview into `output`. Throws FfmpegMissingError without ffmpeg. */
export async function renderPreview(
  input: Omit<PreviewArgsInput, 'introCard' | 'outroCard'> & { workDir: string; intro?: Buffer; outro?: Buffer },
  run: RunProgram = renderProgram,
  binary = ffmpegBinary(),
): Promise<void> {
  const introCard = input.intro ? path.join(input.workDir, 'intro.png') : undefined;
  const outroCard = input.outro ? path.join(input.workDir, 'outro.png') : undefined;
  if (introCard && input.intro) await writeFile(introCard, input.intro);
  if (outroCard && input.outro) await writeFile(outroCard, input.outro);
  try {
    await run(binary, previewArgs({ ...input, ...(introCard ? { introCard } : {}), ...(outroCard ? { outroCard } : {}) }));
  } catch (error) {
    if (isMissingProgram(error)) throw new FfmpegMissingError(`ffmpeg was not found (${binary}); install ffmpeg or set FFMPEG_PATH`);
    throw new PreviewError(`ffmpeg could not render the preview: ${programMessage(error)}`);
  }
}

/** One still frame of a video as PNG (e.g. to choose the poster frame, which App Store Connect sets per preview). */
export async function renderFrame(video: string, seconds: number, output: string, run: RunProgram = renderProgram, binary = ffmpegBinary()): Promise<void> {
  try {
    await run(binary, ['-hide_banner', '-loglevel', 'error', '-y', '-protocol_whitelist', 'file', '-ss', String(seconds), '-i', video, '-frames:v', '1', output]);
  } catch (error) {
    if (isMissingProgram(error)) throw new FfmpegMissingError(`ffmpeg was not found (${binary}); install ffmpeg or set FFMPEG_PATH`);
    throw new PreviewError(`ffmpeg could not read the frame: ${programMessage(error)}`);
  }
}
