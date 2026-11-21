import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { registerOutputs, type RegisterOptions } from '../export/index.js';
import { isLocaleId, type LocaleId } from '../locales/index.js';
import { getSpec, validateMedia } from '../specs/index.js';
import type { SpecEntry } from '../specs/types.js';
import { probeVideo, type VideoProperties } from '../video/index.js';
import type { ProjectSettings, Workspace } from '../workspace/index.js';

/** The frames brag renders; each one is a promo video spec (#22). */
export const PROMO_FORMATS = ['landscape', 'vertical', 'square'] as const;
export type PromoFormat = (typeof PROMO_FORMATS)[number];

export function isPromoFormat(value: unknown): value is PromoFormat {
  return typeof value === 'string' && (PROMO_FORMATS as readonly string[]).includes(value);
}

/** The web spec of each format; the 16:9 video also becomes the YouTube file for the Play listing. */
export const PROMO_SPECS: Record<PromoFormat, string> = {
  landscape: 'web.promo.landscape',
  vertical: 'web.promo.vertical',
  square: 'web.promo.square',
};
export const PLAY_PROMO_SPEC = 'google.promo-video';

/** Length the skill aims for: Play autoplays the first 30 s, brag renders 15–25 s. */
export const PROMO_SECONDS = { min: 15, max: 30 } as const;
/** Largest promo video the tool takes from a job folder. */
export const MAX_PROMO_BYTES = 500 * 1024 * 1024;
/** Where the skill saves each video, relative to the job folder. */
export const PROMO_OUTPUT = 'videos/<locale>/<format>.mp4';

/** Options of a promo video job, as the UI sends them. */
export interface PromoOptions {
  formats?: PromoFormat[];
  /** Public website of the app (http or https). */
  website?: string;
  /** Repository of the app (http or https), e.g. on GitHub. */
  repo?: string;
}

/** The promo part of `brief.json`. */
export interface BriefPromo {
  engine: 'brag';
  /**
   * Per format: its size, every spec it is added to (the 16:9 one also as the Play YouTube file with Google Play on),
   * and the length all of these specs accept.
   */
  formats: { format: PromoFormat; specId: string; specIds: string[]; width: number; height: number; minSeconds: number; maxSeconds: number }[];
  seconds: typeof PROMO_SECONDS;
  fps: 30;
  sources: { website?: string; repo?: string };
  output: typeof PROMO_OUTPUT;
}

/** A rendered promo video found in a job folder and checked against its spec. */
export interface PromoVideo {
  locale: LocaleId;
  format: PromoFormat;
  /** Path relative to the job folder, e.g. `videos/de-DE/landscape.mp4`. */
  path: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
}

/** Checks the promo options of a job request; returns the problems (empty when valid). */
export function promoOptionErrors(raw: unknown): string[] {
  if (raw === undefined) return [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ['promo must be an object'];
  const { formats, website, repo, ...rest } = raw as Record<string, unknown>;
  const errors = Object.keys(rest).map((key) => `promo.${key} is not an option`);
  if (formats !== undefined && !(Array.isArray(formats) && formats.length > 0 && formats.every(isPromoFormat))) {
    errors.push(`promo.formats must be a list of ${PROMO_FORMATS.join(', ')}`);
  }
  for (const [name, value] of [['website', website], ['repo', repo]] as const) {
    if (value !== undefined && !isWebUrl(value)) errors.push(`promo.${name} must be an http or https URL`);
  }
  return errors;
}

function isWebUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** The stores and channels a promo job serves: the web formats, and the Play YouTube file when Google Play is on. */
export function promoTargets(project: ProjectSettings): { web: boolean; google: boolean } {
  return { web: project.targets.web.enabled, google: project.targets.google.enabled };
}

/**
 * The promo part of the brief. Formats default to all three with the web target on, otherwise 16:9 only (the YouTube
 * file for Play); Play alone always gets 16:9.
 */
export function briefPromo(project: ProjectSettings, options: PromoOptions = {}): BriefPromo {
  const targets = promoTargets(project);
  const wanted = options.formats ?? (targets.web ? [...PROMO_FORMATS] : ['landscape']);
  const formats = targets.web ? wanted : (['landscape'] as PromoFormat[]);
  const sizeOf = (spec: SpecEntry) => (spec.dimensions.kind === 'fixed' ? spec.dimensions.sizes[0]! : { width: 0, height: 0 });
  return {
    engine: 'brag',
    formats: PROMO_FORMATS.filter((format) => formats.includes(format)).map((format) => {
      const specId = PROMO_SPECS[format];
      const specIds = specsFor(format, targets);
      const limits = specIds.map((id) => getSpec(id).video ?? { minSeconds: 0, maxSeconds: Infinity });
      return {
        format,
        specId,
        specIds,
        ...sizeOf(getSpec(specId)),
        minSeconds: Math.max(...limits.map((l) => l.minSeconds)),
        maxSeconds: Math.min(...limits.map((l) => l.maxSeconds)),
      };
    }),
    seconds: PROMO_SECONDS,
    fps: 30,
    sources: { ...(options.website ? { website: options.website } : {}), ...(options.repo ? { repo: options.repo } : {}) },
    output: PROMO_OUTPUT,
  };
}

/** The specs a promo video of this format is added to with these targets (#22). */
export function specsFor(format: PromoFormat, targets: { web: boolean; google: boolean }): string[] {
  return [...(targets.web ? [PROMO_SPECS[format]] : []), ...(targets.google && format === 'landscape' ? [PLAY_PROMO_SPEC] : [])];
}

export type ProbeVideo = (file: string) => Promise<VideoProperties>;

/** Files a job folder may hold next to the videos: the music credits, and metadata the OS writes (#22). */
const IGNORED = /^(\..*|Thumbs\.db|desktop\.ini)$/i;
const CREDITS = 'CREDITS.txt';

/**
 * ffprobe results by file, size and change time: jobs are read on every watcher event and every list, and an unchanged
 * video need not be measured again. Bounded; the oldest results are dropped first.
 */
const probeCache = new Map<string, VideoProperties>();
const PROBE_CACHE_SIZE = 500;
async function cachedProbe(probe: ProbeVideo, file: string, stamp: string): Promise<VideoProperties> {
  const key = `${file}\0${stamp}`;
  const hit = probeCache.get(key);
  if (hit) return hit;
  const props = await probe(file);
  probeCache.set(key, props);
  if (probeCache.size > PROBE_CACHE_SIZE) probeCache.delete(probeCache.keys().next().value!);
  return props;
}

/**
 * Finds the rendered videos of a promo job (`videos/<locale>/<format>.mp4`) and checks each against its spec with
 * ffprobe. Only regular files inside the job folder count; links, other names and languages are errors. Languages or
 * formats not rendered yet are warnings, so a partial result can still be applied.
 */
export async function inspectPromoVideos(
  folder: string,
  locales: readonly LocaleId[],
  promo: BriefPromo,
  probe: ProbeVideo = (file) => probeVideo(file),
): Promise<{ found: boolean; videos: PromoVideo[]; errors: string[]; warnings: string[]; fingerprint?: string }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const videos: PromoVideo[] = [];
  const stamps: string[] = [];
  const root = path.join(folder, 'videos');
  const info = await lstat(root).catch(() => null);
  if (!info) return { found: false, videos, errors, warnings };
  if (!info.isDirectory()) return { found: true, videos, errors: ['videos: must be a folder with one folder per language'], warnings };
  const formats = new Map(promo.formats.map((entry) => [entry.format, entry]));
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (IGNORED.test(entry.name) || (entry.name === CREDITS && entry.isFile())) continue;
    if (!entry.isDirectory() || !isLocaleId(entry.name) || !locales.includes(entry.name)) {
      errors.push(`videos/${entry.name}: not a language folder of this job`);
      continue;
    }
    const locale = entry.name;
    for (const file of await readdir(path.join(root, locale), { withFileTypes: true })) {
      if (IGNORED.test(file.name)) continue;
      const relative = `videos/${locale}/${file.name}`;
      const format = file.name.replace(/\.mp4$/, '');
      if (!file.name.endsWith('.mp4') || !isPromoFormat(format) || !formats.has(format)) {
        errors.push(`${relative}: not a video of this job (${promo.formats.map((f) => `${f.format}.mp4`).join(', ')})`);
        continue;
      }
      const absolute = path.join(root, locale, file.name);
      const stat = await lstat(absolute);
      if (!stat.isFile()) {
        errors.push(`${relative}: not a regular file`);
        continue;
      }
      if (stat.size > MAX_PROMO_BYTES) {
        errors.push(`${relative}: larger than ${MAX_PROMO_BYTES / 1024 / 1024} MB`);
        continue;
      }
      const stamp = `${stat.size}:${stat.mtimeMs}`;
      let props: VideoProperties;
      try {
        props = await cachedProbe(probe, absolute, stamp);
      } catch (error) {
        errors.push(`${relative}: ${(error as Error).message}`);
        continue;
      }
      // Checked against every spec it is added to (older briefs: the web spec only).
      const wanted = formats.get(format)!;
      const specIds = wanted.specIds ?? [wanted.specId];
      const violations = [...new Set(specIds.flatMap((id) => validateMedia(getSpec(id), props).map((v) => v.message)))];
      if (violations.length > 0) {
        errors.push(...violations.map((message) => `${relative}: ${message}`));
        continue;
      }
      if (specIds.includes(PLAY_PROMO_SPEC) && props.durationSeconds !== undefined && props.durationSeconds > PROMO_SECONDS.max) {
        warnings.push(`${relative}: lasts ${Math.round(props.durationSeconds)} s; Google Play autoplays only the first ${PROMO_SECONDS.max} s`);
      }
      videos.push({ locale, format, path: relative, width: props.width ?? 0, height: props.height ?? 0, durationSeconds: props.durationSeconds ?? 0, bytes: stat.size });
      stamps.push(`${relative}:${stamp}`);
    }
  }
  for (const locale of locales) {
    const missing = promo.formats.filter(({ format }) => !videos.some((v) => v.locale === locale && v.format === format)).map((f) => f.format);
    if (missing.length > 0 && videos.length > 0) warnings.push(`${locale}: no ${missing.join(', ')} video yet`);
  }
  videos.sort((a, b) => a.path.localeCompare(b.path));
  return {
    found: true,
    videos,
    errors,
    warnings,
    ...(stamps.length > 0 ? { fingerprint: createHash('sha256').update(stamps.sort().join('\n')).digest('hex') } : {}),
  };
}

/**
 * Copies the checked videos of a promo job into the output folder: one web promo per format with the web target on,
 * and the 16:9 one as the YouTube file for Play with Google Play on. Earlier promo videos of these languages are
 * replaced. Returns the languages written.
 */
export async function registerPromoVideos(workspace: Workspace, project: ProjectSettings, folder: string, videos: readonly PromoVideo[]): Promise<LocaleId[]> {
  const targets = promoTargets(project);
  const list: RegisterOptions[] = [];
  for (const video of videos) {
    const sourceFile = path.join(folder, video.path);
    const common = { locale: video.locale, order: 1, name: 'promo', extension: 'mp4', sourceFile } as const;
    if (targets.web) list.push({ specId: PROMO_SPECS[video.format], ...common });
    if (targets.google && video.format === 'landscape') list.push({ specId: PLAY_PROMO_SPEC, ...common });
  }
  const locales = [...new Set(videos.map((v) => v.locale))];
  if (list.length === 0) return [];
  const specIds = [...new Set(list.map((entry) => entry.specId))];
  await registerOutputs(workspace, list, { replaceSets: { specIds, locales } });
  return locales;
}
