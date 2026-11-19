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

/** The ffmpeg binary: `FFMPEG_PATH` when set, otherwise `ffmpeg` from the PATH. */
export function ffmpegBinary(env: NodeJS.ProcessEnv = process.env): string {
  return env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

/**
 * The ffprobe binary: `FFPROBE_PATH` when set; otherwise next to `FFMPEG_PATH` when that names a file and an ffprobe
 * lies beside it (ffmpeg builds ship both); otherwise `ffprobe` from the PATH.
 */
export function ffprobeBinary(env: NodeJS.ProcessEnv = process.env, exists: (file: string) => boolean = existsSync): string {
  const explicit = env.FFPROBE_PATH?.trim();
  if (explicit) return explicit;
  const ffmpeg = env.FFMPEG_PATH?.trim();
  if (ffmpeg && /[\\/]/.test(ffmpeg)) {
    const name = path.basename(ffmpeg).replace(/^ffmpeg/i, 'ffprobe');
    const sibling = path.join(path.dirname(ffmpeg), name);
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
