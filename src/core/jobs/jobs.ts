import { createHash, randomInt } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isLocaleId, resolveLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import type { CardLayout } from '../screenshots/index.js';
import {
  effectiveSet,
  listInputs,
  listScreenshots,
  originalInputName,
  readProject,
  readScreenshotSets,
  saveScreenshotSets,
  writeJsonAtomic,
  type ProjectSettings,
  type ScreenshotEntry,
  type Workspace,
} from '../workspace/index.js';
import { FfmpegMissingError, extractFrames, ffmpegBinary, runProgram, type RunProgram } from './frames.js';
import {
  JOB_VERSION,
  MAX_STORE_TEXT,
  STORE_TEXT_FIELDS,
  headlinesSchema,
  resultJsonSchemas,
  storyboardSchema,
  type HeadlinesResult,
  type StoreTextField,
  type StoryboardResult,
} from './schemas.js';

/** Job folder names: creation time plus a random tag, e.g. `20261119-104512-k3x9`. Nothing else is a job. */
export const JOB_ID = /^\d{8}-\d{6}-[a-z0-9]{4}$/;
/** Largest result file read from a job folder. */
const MAX_RESULT_BYTES = 256 * 1024;
/**
 * Recommended copy lengths per card layout (copy rules §8: headline about 30 characters, subline about 40), adjusted to
 * the start font size of each layout: the large-device layout has the biggest headline, text at the bottom the
 * smallest. Longer texts still render (the card shrinks them); they are reported as warnings, not errors.
 */
export const COPY_LIMITS: Record<CardLayout, { headline: number; subline: number }> = {
  'text-top': { headline: 30, subline: 40 },
  // Same subline size as text-top; only the headline starts larger.
  'text-top-large': { headline: 26, subline: 40 },
  'text-bottom': { headline: 34, subline: 44 },
};

export type JobTask = 'copy';
export type JobStatus = 'waiting' | 'ready' | 'invalid' | 'applied';

/** Invalid job request; `status` is the HTTP status the API answers with. */
export class JobError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

export interface BriefSlot {
  slot: number;
  /** Workspace path of the screenshot (results name the slot by this value). */
  input: string;
  /** The screenshot inside the job folder. */
  image: string;
  headline: string;
  subline: string;
  /** The locale has no own screenshots and uses the source locale's. */
  fallbackInput: boolean;
  /**
   * Card layout of the slot and the recommended maximum lengths that follow from it. Optional when read back: briefs
   * written before per-layout limits have neither (see limitsFor).
   */
  layout?: CardLayout;
  limits?: { headline: number; subline: number };
}

/** The copy limits of a brief slot: its own, or those of its layout, or the general text-top limits. */
export function limitsFor(slot: Pick<BriefSlot, 'layout' | 'limits'> | undefined): { headline: number; subline: number } {
  return slot?.limits ?? (slot?.layout ? COPY_LIMITS[slot.layout] : undefined) ?? COPY_LIMITS['text-top'];
}

export interface Brief {
  version: typeof JOB_VERSION;
  id: string;
  task: JobTask;
  createdAt: string;
  instructions: string;
  project: { name: string; sourceLocale: LocaleId; locales: LocaleId[] };
  screenshots: Partial<Record<LocaleId, BriefSlot[]>>;
  videos: { input: string; locale?: LocaleId; frames: string[] }[];
  notes: string[];
  results: { headlines: string; storeTexts: string; storyboard: string };
  storeTextFields: readonly StoreTextField[];
  schemas: { headlines: string; storyboard: string };
}

export interface JobState {
  id: string;
  task: JobTask;
  createdAt: string;
  locales: LocaleId[];
  /** Absolute path of the job folder. */
  folder: string;
  /** What to run in the editor, e.g. `/amc-copy "…/jobs/20261119-104512-k3x9"`. */
  command: string;
  status: JobStatus;
  /** Why the results are invalid; invalid results are never applied. */
  errors: string[];
  warnings: string[];
  headlines?: HeadlinesResult;
  storeTexts?: Partial<Record<LocaleId, Partial<Record<StoreTextField, string>>>>;
  storyboard?: StoryboardResult;
  applied?: { variant: 'A' | 'B'; at: string };
}

export interface CreateJobOptions {
  task?: JobTask;
  /** Languages the AI writes for; default all languages of the project. */
  locales?: LocaleSelection;
}

export interface JobDeps {
  run?: RunProgram;
  ffmpeg?: string;
  now?: Date;
}

const INSTRUCTIONS =
  'Write headlines.json (and, when asked, store-texts/<locale>/<field>.md) into this folder. Follow the copy rules of ' +
  'the amc-copy skill and claims.json: never use a forbidden claim. Name every slot by its "input". Check your JSON ' +
  'against schemas/ before saving. The tool validates the results and applies them only when the user chooses to.';

function jobFolder(workspace: Workspace, id: string): string {
  if (!JOB_ID.test(id)) throw new JobError(`${id} is not a job id`, 404);
  return path.join(workspace.jobsDir, id);
}

function commandFor(folder: string): string {
  return `/amc-copy "${folder}"`;
}

function newId(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  // Unbiased: randomInt picks each character uniformly from the 36 allowed.
  const tag = Array.from({ length: 4 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[randomInt(36)]).join('');
  return `${stamp}-${tag}`;
}

/**
 * Prepares an AI job: `brief.json` with the screenshots of each language (its own set or the source language's),
 * `claims.json`, the screenshots under `images/`, still frames of uploaded videos under `frames/` (needs ffmpeg), and
 * the JSON Schemas of the result files under `schemas/`.
 */
export async function createJob(workspace: Workspace, options: CreateJobOptions = {}, deps: JobDeps = {}): Promise<JobState> {
  const task = options.task ?? 'copy';
  if (task !== 'copy') throw new JobError(`Unknown job task: ${String(task)}`);
  const project = await readProject(workspace);
  let locales: LocaleId[];
  try {
    locales = options.locales === undefined ? project.locales : resolveLocales(options.locales);
  } catch (error) {
    throw new JobError((error as Error).message);
  }
  const outside = locales.filter((locale) => !project.locales.includes(locale));
  if (outside.length > 0) throw new JobError(`${outside.join(', ')} ${outside.length === 1 ? 'is' : 'are'} not a language of this project`);

  const inputs = await listInputs(workspace);
  const screenshots = inputs.filter((input) => input.kind === 'screenshot');
  if (screenshots.length === 0) throw new JobError(`Upload screenshots for ${project.sourceLocale} first`);
  const sets = await readScreenshotSets(workspace, screenshots);

  const now = deps.now ?? new Date();
  const id = newId(now);
  const folder = path.join(workspace.jobsDir, id);
  await mkdir(path.join(folder, 'images'), { recursive: true });

  // Each screenshot is copied once, also when several languages use it.
  const images = new Map<string, string>();
  const imageFor = async (input: string): Promise<string> => {
    const known = images.get(input);
    if (known) return known;
    const name = `images/${String(images.size + 1).padStart(2, '0')}-${originalInputName(input)}${path.extname(input).toLowerCase()}`;
    await copyFile(path.join(workspace.root, input), path.join(folder, name));
    images.set(input, name);
    return name;
  };
  const briefShots: Brief['screenshots'] = {};
  for (const locale of locales) {
    const entries = effectiveSet(sets, locale, project.sourceLocale, screenshots);
    const slots: BriefSlot[] = [];
    for (const [index, entry] of entries.entries()) {
      const layout = entry.layout ?? sets.style.layout;
      slots.push({
        slot: index + 1,
        input: entry.input,
        image: await imageFor(entry.input),
        headline: entry.headline,
        subline: entry.subline,
        fallbackInput: entry.fallbackInput,
        layout,
        limits: COPY_LIMITS[layout],
      });
    }
    if (slots.length > 0) briefShots[locale] = slots;
  }

  const notes: string[] = [];
  const videos: Brief['videos'] = [];
  for (const [index, video] of inputs.filter((input) => input.kind === 'video').entries()) {
    const dir = `frames/${String(index + 1).padStart(2, '0')}-${originalInputName(video.path)}`;
    try {
      const names = await extractFrames(path.join(workspace.root, video.path), path.join(folder, dir), deps.run ?? runProgram, deps.ffmpeg ?? ffmpegBinary());
      videos.push({ input: video.path, ...(video.locale ? { locale: video.locale } : {}), frames: names.map((name) => `${dir}/${name}`) });
    } catch (error) {
      notes.push(error instanceof FfmpegMissingError ? `${error.message}: video frames are missing` : `${video.path}: ${(error as Error).message}`);
      if (error instanceof FfmpegMissingError) break;
    }
  }

  const brief: Brief = {
    version: JOB_VERSION,
    id,
    task,
    createdAt: now.toISOString(),
    instructions: INSTRUCTIONS,
    project: { name: project.name, sourceLocale: project.sourceLocale, locales },
    screenshots: briefShots,
    videos,
    notes,
    results: { headlines: 'headlines.json', storeTexts: 'store-texts/<locale>/<field>.md', storyboard: 'storyboard.json' },
    storeTextFields: STORE_TEXT_FIELDS,
    schemas: { headlines: 'schemas/headlines.schema.json', storyboard: 'schemas/storyboard.schema.json' },
  };
  await mkdir(path.join(folder, 'schemas'), { recursive: true });
  for (const [name, schema] of Object.entries(resultJsonSchemas())) await writeJsonAtomic(path.join(folder, 'schemas', name), schema);
  await writeJsonAtomic(path.join(folder, 'claims.json'), project.claims);
  // The brief is written last: a folder with a brief is a complete job.
  await writeJsonAtomic(path.join(folder, 'brief.json'), brief);
  return readJob(workspace, id);
}

/** Reads a result file: undefined when absent; only a regular file up to the size limit inside the job folder. */
async function readResult(folder: string, relative: string): Promise<string | undefined> {
  const file = path.join(folder, relative);
  let info;
  try {
    info = await lstat(file);
  } catch {
    return undefined;
  }
  if (!info.isFile()) throw new Error(`${relative} is not a regular file`);
  if (info.size > MAX_RESULT_BYTES) throw new Error(`${relative} is larger than ${MAX_RESULT_BYTES / 1024} KB`);
  return readFile(file, 'utf8');
}

/** Every text of a result, with a label, for the forbidden-claims check. */
function forbiddenUses(texts: { label: string; text: string }[], forbidden: readonly string[]): string[] {
  const errors: string[] = [];
  for (const claim of forbidden) {
    const needle = claim.toLocaleLowerCase();
    for (const { label, text } of texts) {
      if (needle && text.toLocaleLowerCase().includes(needle)) errors.push(`${label}: uses the forbidden claim "${claim}"`);
    }
  }
  return errors;
}

function issues(error: { issues: { path: PropertyKey[]; message: string }[] }, file: string): string[] {
  return error.issues.map((issue) => `${file}${issue.path.length > 0 ? `.${issue.path.map(String).join('.')}` : ''}: ${issue.message}`);
}

/** Fingerprint of a result text, so a job counts as applied only for the exact result that was applied. */
function fingerprint(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** The state of a job: its brief, and every result file present, validated. Invalid results are reported, not used. */
export async function readJob(workspace: Workspace, id: string, projectSettings?: ProjectSettings): Promise<JobState> {
  return (await inspectJob(workspace, id, projectSettings)).state;
}

/** readJob plus the fingerprint of the headlines text it validated (internal: used to record what was applied). */
async function inspectJob(workspace: Workspace, id: string, projectSettings?: ProjectSettings): Promise<{ state: JobState; headlinesHash?: string }> {
  let headlinesHash: string | undefined;
  const folder = jobFolder(workspace, id);
  let brief: Brief;
  try {
    brief = JSON.parse(await readFile(path.join(folder, 'brief.json'), 'utf8')) as Brief;
  } catch {
    throw new JobError(`Job ${id} does not exist`, 404);
  }
  const project = projectSettings ?? (await readProject(workspace));
  const forbidden = project.claims.forbidden;
  const locales = brief.project.locales;
  const state: JobState = {
    id,
    task: brief.task,
    createdAt: brief.createdAt,
    locales,
    folder,
    command: commandFor(folder),
    status: 'waiting',
    errors: [],
    warnings: [...brief.notes],
  };
  let found = false;

  // headlines.json
  try {
    const raw = await readResult(folder, brief.results.headlines);
    if (raw !== undefined) {
      found = true;
      headlinesHash = fingerprint(raw);
      const parsed = headlinesSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) state.errors.push(...issues(parsed.error, 'headlines.json'));
      else {
        const texts: { label: string; text: string }[] = [];
        for (const [locale, { slots }] of Object.entries(parsed.data.locales)) {
          if (!isLocaleId(locale) || !locales.includes(locale)) {
            state.errors.push(`headlines.json: ${locale} is not a language of this job`);
            continue;
          }
          const known = new Set((brief.screenshots[locale] ?? []).map((slot) => slot.input));
          const slotOf = new Map((brief.screenshots[locale] ?? []).map((slot) => [slot.input, slot]));
          const seen = new Set<string>();
          for (const slot of slots) {
            if (!known.has(slot.input)) state.errors.push(`headlines.json: ${locale} names ${slot.input}, which is not a screenshot of this job`);
            if (seen.has(slot.input)) state.errors.push(`headlines.json: ${locale} names ${slot.input} twice`);
            seen.add(slot.input);
            const briefSlot = slotOf.get(slot.input);
            const limits = limitsFor(briefSlot);
            for (const variant of ['A', 'B'] as const) {
              // Names the slot, so a warning points at the screenshot whose text is too long.
              const label = `headlines.json ${locale} slot ${briefSlot?.slot ?? '?'} ${variant}`;
              texts.push({ label, text: `${slot[variant].headline} ${slot[variant].subline}` });
              if (slot[variant].headline.length > limits.headline) state.warnings.push(`${label}: "${slot[variant].headline}" is longer than ${limits.headline} characters`);
              if (slot[variant].subline.length > limits.subline) state.warnings.push(`${label}: the subline is longer than ${limits.subline} characters`);
            }
          }
        }
        state.errors.push(...forbiddenUses(texts, forbidden));
        state.headlines = parsed.data;
      }
    }
  } catch (error) {
    found = true;
    state.errors.push(`headlines.json: ${error instanceof SyntaxError ? 'not valid JSON' : (error as Error).message}`);
  }

  // store-texts/<locale>/<field>.md
  const storeDir = path.join(folder, 'store-texts');
  const storeTexts: NonNullable<JobState['storeTexts']> = {};
  // Any problem with the folder itself (a file instead of a folder, unreadable) makes the job invalid, never an error.
  try {
    const info = await lstat(storeDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    // Links count as "not a folder": result files are read only as real files inside the job folder.
    if (info && !info.isDirectory()) {
      found = true;
      state.errors.push('store-texts: must be a folder with one folder per language');
    }
    const entries = info?.isDirectory() ? await readdir(storeDir, { withFileTypes: true }) : [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !isLocaleId(entry.name) || !locales.includes(entry.name)) {
        state.errors.push(`store-texts/${entry.name}: not a language folder of this job`);
        continue;
      }
      const locale = entry.name;
      let files: string[];
      try {
        files = await readdir(path.join(storeDir, locale));
      } catch {
        state.errors.push(`store-texts/${locale}: cannot be read`);
        continue;
      }
      for (const file of files) {
        found = true;
        const field = file.replace(/\.md$/, '') as StoreTextField;
        if (!file.endsWith('.md') || !STORE_TEXT_FIELDS.includes(field)) {
          state.errors.push(`store-texts/${locale}/${file}: not a store text field (${STORE_TEXT_FIELDS.join(', ')})`);
          continue;
        }
        try {
          const text = ((await readResult(folder, `store-texts/${locale}/${file}`)) ?? '').trim();
          if (!text) state.errors.push(`store-texts/${locale}/${file}: empty`);
          else if (text.length > MAX_STORE_TEXT) state.errors.push(`store-texts/${locale}/${file}: longer than ${MAX_STORE_TEXT} characters`);
          else {
            state.errors.push(...forbiddenUses([{ label: `store-texts/${locale}/${file}`, text }], forbidden));
            (storeTexts[locale] ??= {})[field] = text;
          }
        } catch (error) {
          state.errors.push(`store-texts/${locale}/${file}: ${(error as Error).message}`);
        }
      }
    }
  } catch {
    found = true;
    state.errors.push('store-texts: cannot be read');
  }
  if (Object.keys(storeTexts).length > 0) state.storeTexts = storeTexts;

  // storyboard.json
  try {
    const raw = await readResult(folder, brief.results.storyboard);
    if (raw !== undefined) {
      found = true;
      const parsed = storyboardSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) state.errors.push(...issues(parsed.error, 'storyboard.json'));
      else {
        const images = new Set([...Object.values(brief.screenshots).flatMap((slots) => (slots ?? []).map((slot) => slot.image)), ...brief.videos.flatMap((video) => video.frames)]);
        for (const [index, scene] of parsed.data.scenes.entries()) {
          if (!images.has(scene.image)) state.errors.push(`storyboard.json: scene ${index + 1} shows ${scene.image}, which is not an image of this job`);
          for (const locale of Object.keys(scene.captions)) {
            if (!isLocaleId(locale) || !locales.includes(locale)) state.errors.push(`storyboard.json: scene ${index + 1} has a caption for ${locale}, not a language of this job`);
          }
          state.errors.push(...forbiddenUses(Object.entries(scene.captions).map(([locale, text]) => ({ label: `storyboard.json scene ${index + 1} ${locale}`, text })), forbidden));
        }
        state.storyboard = parsed.data;
      }
    }
  } catch (error) {
    found = true;
    state.errors.push(`storyboard.json: ${error instanceof SyntaxError ? 'not valid JSON' : (error as Error).message}`);
  }

  if (state.errors.length > 0) {
    state.status = 'invalid';
    // Nothing of an invalid job may be applied.
    delete state.headlines;
    headlinesHash = undefined;
    delete state.storeTexts;
    delete state.storyboard;
  } else if (found) state.status = 'ready';

  try {
    const applied = JSON.parse(await readFile(path.join(folder, 'applied.json'), 'utf8')) as { variant: 'A' | 'B'; at: string; headlines?: string };
    // A rewritten headlines.json (a second AI run in the same folder) is a new result, not the applied one.
    if (state.status === 'ready' && applied.headlines !== undefined && applied.headlines === headlinesHash) {
      state.applied = { variant: applied.variant, at: applied.at };
      state.status = 'applied';
    }
  } catch {
    // Not applied yet.
  }
  return { state, ...(headlinesHash ? { headlinesHash } : {}) };
}

/** All jobs, newest first. Folders that are not jobs (other names, no brief) are skipped. */
export async function listJobs(workspace: Workspace, limit = Infinity): Promise<JobState[]> {
  const names = existsSync(workspace.jobsDir) ? await readdir(workspace.jobsDir) : [];
  const project = await readProject(workspace);
  const jobs: JobState[] = [];
  for (const name of names.filter((n) => JOB_ID.test(n)).sort().reverse()) {
    if (jobs.length >= limit) break;
    try {
      jobs.push(await readJob(workspace, name, project));
    } catch (error) {
      if (!(error instanceof JobError)) throw error;
    }
  }
  return jobs;
}

/**
 * Applies one variant of a ready job's headlines to the screenshot sets. Each language starts from its current set
 * (its own, or the source language's for a language without one): order, screenshots and style overrides stay as they
 * are now, and only the headline and subline of the screenshots the result names change. A language that used the
 * source language's set gets its own copy of it.
 */
export async function applyHeadlines(workspace: Workspace, id: string, variant: 'A' | 'B'): Promise<{ locales: LocaleId[] }> {
  if (variant !== 'A' && variant !== 'B') throw new JobError('variant must be A or B');
  const { state, headlinesHash } = await inspectJob(workspace, id);
  if (state.status === 'invalid') throw new JobError(`Job ${id} has invalid results: ${state.errors.join('; ')}`, 409);
  if (!state.headlines) throw new JobError(`Job ${id} has no headlines yet`, 409);
  const project = await readProject(workspace);
  const headlines = state.headlines;
  // Read, change and save the current sets; when a page saved in between (conflict), start again from its version.
  let applied: LocaleId[] = [];
  for (let attempt = 1; ; attempt += 1) {
    const screenshots = await listScreenshots(workspace);
    const sets = await readScreenshotSets(workspace, screenshots);
    const next = { ...sets, sets: { ...sets.sets } };
    applied = [];
    for (const [locale, { slots }] of Object.entries(headlines.locales) as [LocaleId, HeadlinesResult['locales'][string]][]) {
      const byInput = new Map(slots.map((slot) => [slot.input, slot[variant]]));
      const current = effectiveSet(sets, locale, project.sourceLocale, screenshots);
      if (!current.some((entry) => byInput.has(entry.input))) continue;
      next.sets[locale] = current.map(({ fallbackInput: _fallback, ...entry }): ScreenshotEntry => {
        const text = byInput.get(entry.input);
        return text ? { ...entry, headline: text.headline, subline: text.subline ?? '' } : entry;
      });
      applied.push(locale);
    }
    if (applied.length === 0) throw new JobError(`None of the screenshots of job ${id} are in the sets any more`, 409);
    const saved = await saveScreenshotSets(workspace, next);
    if (saved.ok) break;
    if (!saved.conflict) throw new JobError(`The headlines no longer fit the screenshots: ${saved.errors.join('; ')}`, 409);
    if (attempt >= 3) throw new JobError('The screenshot sets keep changing; try applying again', 409);
  }
  // The fingerprint of the text that was validated and applied, not of the file as it is now.
  await writeJsonAtomic(path.join(state.folder, 'applied.json'), { variant, at: new Date().toISOString(), headlines: headlinesHash });
  return { locales: applied };
}
