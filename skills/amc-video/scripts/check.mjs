#!/usr/bin/env node
// Checks the promo videos in an app-media-creator job folder before the skill hands them over. No dependencies besides
// ffprobe (FFPROBE_PATH, or ffprobe on the PATH).
// Usage: node check.mjs "<job folder>"
// Exit code 0: no errors (warnings are printed). Exit code 1: errors to fix. Exit code 2: the folder or ffprobe cannot
// be used. The tool checks the videos again when it reads them; this check only catches mistakes earlier.
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const folder = process.argv[2];
if (!folder) {
  console.error('Usage: node check.mjs "<job folder>"');
  process.exit(2);
}

let brief;
try {
  brief = JSON.parse(readFileSync(path.join(folder, 'brief.json'), 'utf8'));
} catch (error) {
  console.error(`${error.code === 'ENOENT' ? 'brief.json is missing' : 'brief.json is not valid JSON'}: is this an app-media-creator job folder?`);
  process.exit(2);
}
if (!brief || !brief.promo || !Array.isArray(brief.promo.formats)) {
  console.error('brief.json has no promo: this job is not a promo video job.');
  process.exit(2);
}

// Like the tool: FFPROBE_PATH, else the ffprobe beside an FFMPEG_PATH named ffmpeg…, else ffprobe on the PATH.
function ffprobeBinary() {
  const own = process.env.FFPROBE_PATH?.trim();
  if (own) return own;
  const ffmpeg = process.env.FFMPEG_PATH?.trim();
  if (ffmpeg && /^ffmpeg/i.test(path.basename(ffmpeg))) {
    const beside = path.join(path.dirname(ffmpeg), path.basename(ffmpeg).replace(/^ffmpeg/i, 'ffprobe'));
    try {
      if (lstatSync(beside).isFile()) return beside;
    } catch {
      // Not there: ffprobe from the PATH.
    }
  }
  return 'ffprobe';
}
const FFPROBE = ffprobeBinary();
// The brief names the length every spec of a format accepts; older briefs: the web promo limits (5–60 s).
const limitOf = (entry) => ({ min: entry.minSeconds ?? 5, max: entry.maxSeconds ?? 60 });
// Files a job folder may hold next to the videos: the music credits, and metadata the OS writes.
const IGNORED = /^(\..*|Thumbs\.db|desktop\.ini)$/i;
const MAX_BYTES = 500 * 1024 * 1024;
const locales = Array.isArray(brief.project?.locales) ? brief.project.locales : [];
const formats = new Map(brief.promo.formats.map((entry) => [entry.format, entry]));
const errors = [];
const warnings = [];
const rendered = new Set();

function probe(file) {
  try {
    const out = execFileSync(FFPROBE, ['-v', 'error', '-protocol_whitelist', 'file', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8', windowsHide: true });
    return JSON.parse(out);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`ffprobe was not found (${FFPROBE}); install ffmpeg or set FFPROBE_PATH.`);
      process.exit(2);
    }
    return { error: 'ffprobe cannot read it' };
  }
}

function frameRate(text) {
  const [n, d] = String(text ?? '0/1').split('/').map(Number);
  return d ? n / d : n;
}

const root = path.join(folder, 'videos');
let languages = [];
try {
  languages = readdirSync(root, { withFileTypes: true });
} catch {
  console.error('videos/ is missing: save each render as videos/<locale>/<format>.mp4.');
  process.exit(1);
}
for (const entry of languages) {
  if (IGNORED.test(entry.name) || (entry.name === 'CREDITS.txt' && entry.isFile())) continue;
  if (!entry.isDirectory() || !locales.includes(entry.name)) {
    errors.push(`videos/${entry.name}: not a language folder of this job (${locales.join(', ')})`);
    continue;
  }
  for (const file of readdirSync(path.join(root, entry.name), { withFileTypes: true })) {
    if (IGNORED.test(file.name)) continue;
    const relative = `videos/${entry.name}/${file.name}`;
    const format = file.name.replace(/\.mp4$/, '');
    if (!file.name.endsWith('.mp4') || !formats.has(format)) {
      errors.push(`${relative}: not a video of this job (${[...formats.keys()].map((f) => `${f}.mp4`).join(', ')})`);
      continue;
    }
    const absolute = path.join(root, entry.name, file.name);
    const stat = lstatSync(absolute);
    if (!stat.isFile()) {
      errors.push(`${relative}: not a regular file (copy the render, do not link it)`);
      continue;
    }
    if (stat.size > MAX_BYTES) {
      errors.push(`${relative}: larger than 500 MB`);
      continue;
    }
    const data = probe(absolute);
    if (data.error) {
      errors.push(`${relative}: ${data.error}`);
      continue;
    }
    const video = (data.streams ?? []).find((s) => s.codec_type === 'video');
    const want = formats.get(format);
    if (!video) {
      errors.push(`${relative}: has no video stream`);
      continue;
    }
    if (video.width !== want.width || video.height !== want.height) {
      errors.push(`${relative}: is ${video.width} × ${video.height}; ${format} must be exactly ${want.width} × ${want.height}`);
    }
    if (!String(data.format?.format_name ?? '').includes('mp4')) errors.push(`${relative}: is not an MP4 file`);
    const seconds = Number(data.format?.duration ?? 0);
    const limit = limitOf(want);
    if (seconds < limit.min || seconds > limit.max) errors.push(`${relative}: lasts ${seconds.toFixed(1)} s; ${format} needs ${limit.min}–${limit.max} s`);
    else if (seconds > 30 && (want.specIds ?? []).includes('google.promo-video')) warnings.push(`${relative}: lasts ${Math.round(seconds)} s; Google Play autoplays only the first 30 s`);
    if (frameRate(video.avg_frame_rate || video.r_frame_rate) > 60) errors.push(`${relative}: more than 60 fps`);
    rendered.add(`${entry.name}/${format}`);
  }
}
for (const locale of locales) {
  const missing = [...formats.keys()].filter((format) => !rendered.has(`${locale}/${format}`));
  if (missing.length > 0) warnings.push(`${locale}: no ${missing.join(', ')} video yet`);
}

for (const warning of warnings) console.log(`warning: ${warning}`);
for (const error of errors) console.log(`error: ${error}`);
console.log(errors.length === 0 ? `OK: ${rendered.size} video(s) ready for the tool.` : `${errors.length} error(s) to fix.`);
process.exit(errors.length === 0 ? 0 : 1);
