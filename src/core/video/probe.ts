import type { MediaProperties } from '../specs/index.js';
import { FfmpegMissingError, captureProgram, ffprobeBinary, isMissingProgram, programMessage, type CaptureProgram } from './tools.js';

/** The parts of `ffprobe -show_format -show_streams -of json` this tool reads. */
interface ProbeJson {
  streams?: {
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
    r_frame_rate?: string;
    channels?: number;
    tags?: { rotate?: string };
    side_data_list?: { rotation?: number }[];
  }[];
  format?: { format_name?: string; duration?: string; size?: string };
}

/** Measured video properties, plus what the preview pipeline needs to know about the source. */
export interface VideoProperties extends MediaProperties {
  durationSeconds: number;
  fps: number;
  /** Channels of the first audio track; undefined without audio. */
  audioChannels?: number;
  videoCodec?: string;
}

/** `30000/1001` → 29.97; `0/0` or garbage → undefined. */
function frameRate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const [num, den] = value.split('/').map(Number);
  if (num === undefined || !Number.isFinite(num)) return undefined;
  const rate = den === undefined ? num : den > 0 ? num / den : NaN;
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

/**
 * Reads ffprobe's JSON. Width and height are as displayed: a phone recording stored landscape with a 90° rotation
 * counts as portrait, like the stores show it.
 */
export function parseProbe(json: string, bytes?: number): VideoProperties {
  let data: ProbeJson;
  try {
    data = JSON.parse(json) as ProbeJson;
  } catch {
    throw new Error('ffprobe returned no readable result');
  }
  const video = data.streams?.find((stream) => stream.codec_type === 'video');
  if (!video?.width || !video.height) throw new Error('The file has no video track');
  const audio = data.streams?.find((stream) => stream.codec_type === 'audio');
  const rotation = Math.abs(Number(video.side_data_list?.find((side) => side.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)) % 180;
  const [width, height] = rotation === 90 ? [video.height, video.width] : [video.width, video.height];
  const duration = Number(data.format?.duration);
  const fps = frameRate(video.avg_frame_rate) ?? frameRate(video.r_frame_rate);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('The video duration could not be measured');
  if (fps === undefined) throw new Error('The video frame rate could not be measured');
  return {
    width,
    height,
    format: data.format?.format_name ?? '',
    hasAlpha: false,
    bytes: bytes ?? Number(data.format?.size ?? 0),
    durationSeconds: duration,
    fps,
    ...(audio?.channels ? { audioChannels: audio.channels } : {}),
    ...(video.codec_name ? { videoCodec: video.codec_name } : {}),
  };
}

/** Measures a video file with ffprobe. Throws FfmpegMissingError when ffprobe cannot be started. */
export async function probeVideo(file: string, capture: CaptureProgram = captureProgram, binary = ffprobeBinary()): Promise<VideoProperties> {
  let output: string;
  try {
    output = await capture(binary, ['-v', 'error', '-protocol_whitelist', 'file', '-show_format', '-show_streams', '-of', 'json', file]);
  } catch (error) {
    if (isMissingProgram(error)) throw new FfmpegMissingError(`ffprobe was not found (${binary}); install ffmpeg or set FFPROBE_PATH`);
    throw new Error(`ffprobe could not read the video: ${programMessage(error)}`);
  }
  return parseProbe(output);
}
