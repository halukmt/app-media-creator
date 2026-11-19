import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { FfmpegMissingError, ffmpegBinary, isMissingProgram, runProgram, type RunProgram } from '../video/tools.js';

/**
 * Still frames of an uploaded video for the AI: one frame every two seconds, at most 12, 720 px wide, as JPEG.
 * ffmpeg is a system binary (`FFMPEG_PATH` or `ffmpeg` on the PATH); it is started without a shell, with every
 * argument passed separately. Without ffmpeg the job is still created and says so in its brief.
 */

export const FRAME_INTERVAL_SECONDS = 2;
export const MAX_FRAMES = 12;

export { FfmpegMissingError, ffmpegBinary, runProgram, type RunProgram } from '../video/tools.js';

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
    if (isMissingProgram(error)) throw new FfmpegMissingError(`ffmpeg was not found (${binary}); set FFMPEG_PATH`);
    throw new Error(`ffmpeg could not read the video: ${(error as Error).message.split('\n')[0]}`);
  }
  return (await readdir(outDir)).filter((name) => /^frame-\d{2}\.jpg$/.test(name)).sort();
}
