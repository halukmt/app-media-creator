import { stat } from 'node:fs/promises';
import path from 'node:path';
import type { LocaleId } from '../locales/index.js';
import { validateMedia, type SpecEntry, type VideoLimits } from '../specs/index.js';
import { GeneratorError } from './logo.js';
import { probeVideo, type VideoProperties } from '../video/probe.js';
import type { CaptureProgram } from '../video/tools.js';
import { listInputs, type ProjectSettings, type StoredInput, type Workspace } from '../workspace/index.js';

/** A screen recording of one language, with its absolute path. */
export type Recording = StoredInput & { locale: LocaleId; file: string };

export interface LocaleRecordings {
  locale: LocaleId;
  recordings: Recording[];
  /** The language has none of its own and uses the source language's. */
  fallbackInput: boolean;
}

/**
 * The recordings of every chosen language: its own, or the source language's (then marked as fallback input).
 * Languages without any land in `skipped`.
 */
export async function recordingsFor(
  workspace: Workspace,
  project: ProjectSettings,
  locales: readonly LocaleId[],
): Promise<{ perLocale: LocaleRecordings[]; skipped: LocaleId[] }> {
  const videos = (await listInputs(workspace))
    .filter((input): input is StoredInput & { locale: LocaleId } => input.kind === 'video' && input.locale !== undefined)
    .map((input): Recording => ({ ...input, file: path.join(workspace.root, input.path) }));
  const perLocale: LocaleRecordings[] = [];
  const skipped: LocaleId[] = [];
  for (const locale of locales) {
    const own = videos.filter((video) => video.locale === locale);
    const recordings = own.length > 0 ? own : videos.filter((video) => video.locale === project.sourceLocale);
    if (recordings.length === 0) skipped.push(locale);
    else perLocale.push({ locale, recordings, fallbackInput: own.length === 0 && locale !== project.sourceLocale });
  }
  return { perLocale, skipped };
}

/** Measures each recording once per run. */
export function probeCache(capture?: CaptureProgram): (file: string) => Promise<VideoProperties> {
  const cache = new Map<string, Promise<VideoProperties>>();
  return (file) => {
    let probe = cache.get(file);
    if (!probe) {
      probe = probeVideo(file, capture);
      cache.set(file, probe);
    }
    return probe;
  };
}

/** The video limits of a catalogue entry. */
export function videoLimits(spec: SpecEntry): VideoLimits {
  if (!spec.video) throw new Error(`${spec.id} has no video limits`);
  return spec.video;
}

/** A trim from the request: start and end in seconds, both optional and not negative. */
export function checkTrim(trim: unknown): { start?: number; end?: number } | undefined {
  if (trim === undefined) return undefined;
  const valid = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const value = trim as { start?: unknown; end?: unknown };
  if (typeof trim !== 'object' || trim === null || !valid(value.start) || !valid(value.end)) {
    throw new GeneratorError('trim must have a start and an end in seconds');
  }
  return trim as { start?: number; end?: number };
}

/** Texts per language from the request (`name` names the field in messages); blank texts are dropped. */
export function checkLocaleTexts(name: string, texts: unknown, projectLocales: readonly LocaleId[], max: number): Partial<Record<LocaleId, string>> {
  if (texts === undefined) return {};
  if (typeof texts !== 'object' || texts === null || Array.isArray(texts)) throw new GeneratorError(`${name} must be an object of locale → text`);
  const result: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(texts)) {
    if (!projectLocales.includes(locale as LocaleId)) throw new GeneratorError(`${name}: ${locale} is not a locale of this project`);
    if (typeof text !== 'string' || text.length > max) throw new GeneratorError(`${name}.${locale} must be text up to ${max} characters`);
    if (text.trim()) result[locale as LocaleId] = text.trim();
  }
  return result;
}

/** Measures a rendered video with ffprobe and throws when it violates its catalogue entry. */
export async function assertRenderedVideo(spec: SpecEntry, file: string, capture?: CaptureProgram): Promise<void> {
  const measured = await probeVideo(file, capture);
  const violations = validateMedia(spec, { ...measured, bytes: (await stat(file)).size });
  if (violations.length > 0) throw new Error(`the rendered video violates ${spec.name}: ${violations.map((v) => v.message).join('; ')}`);
}
