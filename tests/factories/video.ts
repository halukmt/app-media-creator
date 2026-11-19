import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ffmpegBinary } from '../../src/core/video/index.js';

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
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'amc-rec-')), 'recording.mp4');
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=${fps}:duration=${seconds}`];
  if (audio) args.push('-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=44100:duration=${seconds}`, '-ac', '2');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac'] : []), '-shortest', file);
  execFileSync(ffmpegBinary(), args, { stdio: 'ignore', windowsHide: true });
  return Uint8Array.from(readFileSync(file));
}

/** ffprobe JSON as the probe reads it; override what a test needs. */
export function probeJsonFactory(options: { width?: number; height?: number; rotation?: number; fps?: string; duration?: string; audio?: boolean } = {}): string {
  const { width = 886, height = 1920, rotation, fps = '30/1', duration = '20.000000', audio = true } = options;
  return JSON.stringify({
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width,
        height,
        avg_frame_rate: fps,
        r_frame_rate: fps,
        ...(rotation !== undefined ? { side_data_list: [{ rotation }] } : {}),
      },
      ...(audio ? [{ codec_type: 'audio', codec_name: 'aac', channels: 2 }] : []),
    ],
    format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration, size: '1000' },
  });
}
