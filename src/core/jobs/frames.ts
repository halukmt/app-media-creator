import { execFile } from 'node:child_process';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

/**
 * Still frames of an uploaded video for the AI: one frame every two seconds, at most 12, 720 px wide, as JPEG.
 * ffmpeg is a system binary (`FFMPEG_PATH` or `ffmpeg` on the PATH); it is started without a shell, with every
 * argument passed separately. Without ffmpeg the job is still created and says so in its brief.
 */

export const FRAME_INTERVAL_SECONDS = 2;
export const MAX_FRAMES = 12;

/** Runs a program and resolves when it exits with code 0; injectable for tests. */
export type RunProgram = (file: string, args: readonly string[]) => Promise<void>;

export const runProgram: RunProgram = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, [...args], { windowsHide: true, timeout: 120_000, maxBuffer: 1024 * 1024 }, (error) => (error ? reject(error) : resolve()));
  });

/** The ffmpeg binary: `FFMPEG_PATH` when set, otherwise `ffmpeg` from the PATH. */
export function ffmpegBinary(env: NodeJS.ProcessEnv = process.env): string {
  return env.FFMPEG_PATH?.trim() || 'ffmpeg';
}

export class FfmpegMissingError extends Error {}

/**
 * Extracts the frames of `video` into `outDir` (created) and returns the file names, sorted. Throws
 * FfmpegMissingError when ffmpeg cannot be started, and an Error with ffmpeg's message for a broken video.
 */
export async function extractFrames(video: string, outDir: string, run: RunProgram = runProgram, binary = ffmpegBinary()): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    video,
    '-vf',
    `fps=1/${FRAME_INTERVAL_SECONDS},scale=720:-2`,
    '-frames:v',
    String(MAX_FRAMES),
    '-q:v',
    '4',
    path.join(outDir, 'frame-%02d.jpg'),
  ];
  try {
    await run(binary, args);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new FfmpegMissingError(`ffmpeg was not found (${binary}); set FFMPEG_PATH`);
    throw new Error(`ffmpeg could not read the video: ${(error as Error).message.split('\n')[0]}`);
  }
  return (await readdir(outDir)).filter((name) => /^frame-\d{2}\.jpg$/.test(name)).sort();
}
