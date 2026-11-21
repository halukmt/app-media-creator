import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * ffmpeg and ffprobe are system binaries (`FFMPEG_PATH` / `FFPROBE_PATH`, otherwise from the PATH). They are started
 * without a shell, every argument passed separately, so file names never reach a command line parser.
 */

/** Runs a program and resolves when it exits with code 0; injectable for tests. */
export type RunProgram = (file: string, args: readonly string[]) => Promise<void>;

/** Runs a program and resolves with its standard output; injectable for tests. */
export type CaptureProgram = (file: string, args: readonly string[]) => Promise<string>;

const TIMEOUT = 120_000;
/** Rendering a 30 s preview can take a while on a slow machine. */
export const RENDER_TIMEOUT = 600_000;

export const runProgram: RunProgram = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true, timeout: TIMEOUT, maxBuffer: 1024 * 1024 }, (error) => (error ? reject(error) : resolve()));
  });

/** Like runProgram, with a longer timeout for encoding a video. */
export const renderProgram: RunProgram = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true, timeout: RENDER_TIMEOUT, maxBuffer: 4 * 1024 * 1024 }, (error, _stdout, stderr) =>
      error ? reject(Object.assign(error, { stderr: String(stderr) })) : resolve(),
    );
  });

export const captureProgram: CaptureProgram = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true, timeout: TIMEOUT, maxBuffer: 8 * 1024 * 1024 }, (error, stdout) =>
      error ? reject(error) : resolve(String(stdout)),
    );
  });

/** x264 presets `AMC_X264_PRESET` may choose; faster ones give larger files at the same quality setting. */
const X264_PRESETS = ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium'] as const;

/**
 * The x264 preset for every encode: `veryfast` by default (a local tool should not keep the user waiting), or
 * `AMC_X264_PRESET` when it names a known preset. The tests use `ultrafast` (#77); unknown values are ignored.
 */
export function x264Preset(env: NodeJS.ProcessEnv = process.env): string {
  const wanted = env.AMC_X264_PRESET?.trim();
  return X264_PRESETS.find((preset) => preset === wanted) ?? 'veryfast';
}

/**
 * Encoder thread arguments: none by default (ffmpeg uses every core), `-threads N` when `AMC_FFMPEG_THREADS` is a
 * whole number from 1 to 64. The tests limit it, because many encodes run at the same time there (#77).
 */
export function encoderThreadArgs(env: NodeJS.ProcessEnv = process.env): string[] {
  const threads = Number(env.AMC_FFMPEG_THREADS?.trim());
  return Number.isInteger(threads) && threads >= 1 && threads <= 64 ? ['-threads', String(threads)] : [];
}

/** The ffmpeg binary: `FFMPEG_PATH` when set, otherwise `ffmpeg` from the PATH. */
export function ffmpegBinary(env: NodeJS.ProcessEnv = process.env): string {
  return env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

/**
 * The ffprobe binary: `FFPROBE_PATH` when set; otherwise next to `FFMPEG_PATH` when that names a file called
 * `ffmpeg…` and an `ffprobe…` lies beside it (ffmpeg builds ship both); otherwise `ffprobe` from the PATH.
 */
export function ffprobeBinary(env: NodeJS.ProcessEnv = process.env, exists: (file: string) => boolean = existsSync): string {
  const explicit = env.FFPROBE_PATH?.trim();
  if (explicit) return explicit;
  const ffmpeg = env.FFMPEG_PATH?.trim();
  const base = ffmpeg ? path.basename(ffmpeg) : '';
  // Only a name that starts with "ffmpeg" has a matching ffprobe; otherwise the "sibling" would be ffmpeg itself (#106).
  if (ffmpeg && /[\\/]/.test(ffmpeg) && /^ffmpeg/i.test(base)) {
    const sibling = path.join(path.dirname(ffmpeg), base.replace(/^ffmpeg/i, 'ffprobe'));
    if (exists(sibling)) return sibling;
  }
  return 'ffprobe';
}

export class FfmpegMissingError extends Error {}

/** True when the error says the program could not be started at all. */
export function isMissingProgram(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/** The first line of a program error, plus the last line ffmpeg wrote to stderr (the actual reason). */
export function programMessage(error: unknown): string {
  const first = String((error as Error).message ?? error).split('\n')[0] ?? '';
  const stderr = String((error as { stderr?: string }).stderr ?? '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop();
  return stderr && !first.includes(stderr) ? `${first}: ${stderr}` : first;
}

export interface VideoTools {
  ffmpeg: boolean;
  ffprobe: boolean;
}

/** Whether ffmpeg and ffprobe can be started, for the UI and the API. */
export async function checkVideoTools(run: RunProgram = runProgram, env: NodeJS.ProcessEnv = process.env): Promise<VideoTools> {
  const works = async (binary: string) => {
    try {
      await run(binary, ['-hide_banner', '-version']);
      return true;
    } catch {
      return false;
    }
  };
  const [ffmpeg, ffprobe] = await Promise.all([works(ffmpegBinary(env)), works(ffprobeBinary(env))]);
  return { ffmpeg, ffprobe };
}
