import { tempDir } from './temp.js';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ffmpegBinary, renderFrame } from '../../src/core/video/index.js';
import { saveCreativeSettings, saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { projectInputFactory, workspaceFactory } from './workspace.js';

/** True when ffmpeg can be started; tests that render real videos are skipped without it. */
export function hasFfmpeg(): boolean {
  try {
    execFileSync(ffmpegBinary(), ['-hide_banner', '-version'], { stdio: 'ignore', windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Bytes of a short screen-recording stand-in: a moving test pattern, H.264 in MP4, with a stereo tone unless
 * `audio` is false. Small sizes keep the tests fast.
 */
export function recordingBytes(options: { seconds?: number; width?: number; height?: number; audio?: boolean; fps?: number } = {}): Uint8Array {
  const { seconds = 12, width = 296, height = 640, audio = true, fps = 30 } = options;
  const file = path.join(tempDir('amc-rec-'), 'recording.mp4');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=44100:duration=${seconds}`, '-ac', '2');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac'] : []), '-shortest', file);
  execFileSync(ffmpegBinary(), args, { stdio: 'ignore', windowsHide: true });
  return Uint8Array.from(readFileSync(file));
}

/** ffprobe JSON as the probe reads it; override what a test needs. */
export function probeJsonFactory(
  options: { width?: number; height?: number; rotation?: number; fps?: string; duration?: string; videoDuration?: string; audio?: boolean } = {},
): string {
  const { width = 886, height = 1920, rotation, fps = '30/1', duration = '20.000000', videoDuration, audio = true } = options;
  return JSON.stringify({
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width,
        height,
        avg_frame_rate: fps,
        r_frame_rate: fps,
        ...(videoDuration !== undefined ? { duration: videoDuration } : {}),
        ...(rotation !== undefined ? { side_data_list: [{ rotation }] } : {}),
      },
      ...(audio ? [{ codec_type: 'audio', codec_name: 'aac', channels: 2 }] : []),
    ],
    format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration, size: '1000' },
  });
}

/** Solid background of the device and loop video test projects. */
export const VIDEO_BACKGROUND = { kind: 'solid', color: '#1f8def' } as const;

/** A German and Turkish project with creative phrases and one German recording, for device and loop videos. */
export async function videoWorkspace(recording: Uint8Array): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  const settings = await saveCreativeSettings(workspace, { background: VIDEO_BACKGROUND, phrases: { 'de-DE': 'Faire Teams in Sekunden', 'tr-TR': 'Saniyeler içinde adil takımlar' } });
  if (!settings.ok) throw new Error(settings.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'teams.mp4', bytes: recording });
  return workspace;
}

/** A German and Turkish project with one German recording, for App Store previews; `devices` picks the Apple sizes. */
export async function previewWorkspace(recording: Uint8Array, devices?: string[]): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const input = projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }) as { targets: { apple: { devices: string[] } } };
  if (devices) input.targets.apple.devices = devices;
  const saved = await saveProject(workspace, input);
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'teams.mp4', bytes: recording });
  return workspace;
}

/** Raw RGB of one frame of a video, as sharp reads it. */
export async function frameAt(video: string, seconds: number): Promise<{ data: Buffer; width: number }> {
  const file = path.join(tempDir('amc-frame-'), 'frame.png');
  await renderFrame(video, seconds, file);
  const { data, info } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

/** Mean absolute difference per channel of two raw frames of the same size. */
export function meanDifference(a: Buffer, b: Buffer): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}
