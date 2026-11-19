import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { locateOutputFile, readManifest, registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { selectProjectLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { isBackground, type Background } from '../screenshots/backgrounds.js';
import { getSpec, validateMedia, type Size, type SpecEntry, type VideoLimits } from '../specs/index.js';
import { probeVideo, type VideoProperties } from '../video/probe.js';
import { CARD_SECONDS, orientedSize, planPreview, renderFrame, renderPreview, renderTextCard } from '../video/preview.js';
import { FfmpegMissingError, type CaptureProgram, type RunProgram } from '../video/tools.js';
import { listInputs, originalInputName, readProject, type StoredInput, type Workspace } from '../workspace/index.js';
import { GeneratorError } from './logo.js';
import { fixedSizes } from './outputs.js';

/** App Store preview entries this generator writes: iPhone (also used by iPhone Duo) and iPad. */
const IPHONE = 'apple.preview.iphone';
const IPAD = 'apple.preview.ipad';
const PREVIEW_SPECS = [IPHONE, IPAD] as const;
const MAX_CARD_TEXT = 60;

export interface StorePreviewOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
  /** Part of every recording to use, in seconds. */
  trim?: { start?: number; end?: number };
  /** Text card before the recording, per language (one short line). */
  intro?: Partial<Record<string, string>>;
  /** Text card after the recording, per language. */
  outro?: Partial<Record<string, string>>;
  /** Length of each text card in seconds (1–5, default 2). */
  cardSeconds?: number;
  /** Background of the text cards and of the bars around the recording (default black). */
  background?: Background;
}

export interface StorePreviewWarning {
  path: string;
  message: string;
}

export interface StorePreviewResult {
  entries: OutputEntry[];
  warnings: StorePreviewWarning[];
  /** Languages without a recording of their own or of the source language. */
  skipped: LocaleId[];
}

/** Programs the generator starts; injectable for tests. */
export interface StorePreviewDeps {
  render?: RunProgram;
  capture?: CaptureProgram;
}

const DEFAULT_BACKGROUND: Background = { kind: 'solid', color: '#0a0a0a' };

/** Preview entries for the project: iPhone always, iPad when the project picked an iPad screenshot size. */
function previewSpecs(appleDevices: readonly string[]): string[] {
  return [IPHONE, ...(appleDevices.some((id) => id.startsWith('apple.screenshot.ipad')) ? [IPAD] : [])];
}

function videoLimits(spec: SpecEntry): VideoLimits {
  if (!spec.video) throw new Error(`${spec.id} has no video limits`);
  return spec.video;
}

/** The portrait size of a preview entry; the catalogue lists it first. */
function portraitSize(specId: string): Size {
  const sizes = fixedSizes(specId);
  return sizes.find((size) => size.width <= size.height) ?? sizes[0]!;
}

function checkTexts(name: 'intro' | 'outro', texts: StorePreviewOptions['intro'], projectLocales: readonly LocaleId[]): Partial<Record<LocaleId, string>> {
  if (texts === undefined) return {};
  if (typeof texts !== 'object' || texts === null || Array.isArray(texts)) throw new GeneratorError(`${name} must be an object of locale → text`);
  const result: Partial<Record<LocaleId, string>> = {};
  for (const [locale, text] of Object.entries(texts)) {
    if (!projectLocales.includes(locale as LocaleId)) throw new GeneratorError(`${name}: ${locale} is not a locale of this project`);
    if (typeof text !== 'string' || text.length > MAX_CARD_TEXT) throw new GeneratorError(`${name}.${locale} must be text up to ${MAX_CARD_TEXT} characters`);
    if (text.trim()) result[locale as LocaleId] = text.trim();
  }
  return result;
}

function checkTrim(trim: StorePreviewOptions['trim']): { start?: number; end?: number } | undefined {
  if (trim === undefined) return undefined;
  const valid = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value) && value >= 0);
  if (typeof trim !== 'object' || trim === null || !valid(trim.start) || !valid(trim.end)) {
    throw new GeneratorError('trim must have a start and an end in seconds');
  }
  return trim;
}

function checkCardSeconds(value: unknown): number {
  if (value === undefined) return CARD_SECONDS.default;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < CARD_SECONDS.min || value > CARD_SECONDS.max) {
    throw new GeneratorError(`cardSeconds must be ${CARD_SECONDS.min}–${CARD_SECONDS.max} seconds`);
  }
  return value;
}

const padColorOf = (background: Background) => (background.kind === 'solid' ? background.color : background.from);

/**
 * Renders App Store preview videos for every chosen language and preview size (#20). Each language uses its own
 * recordings (up to the catalogue's count); a language without any uses the source language's and is marked as
 * fallback input. Identical previews (same recording, size and cards) are encoded once. Every video is measured with
 * ffprobe and checked against its catalogue entry before anything is written; then each language replaces its earlier
 * previews of every size, also of a size the project no longer uses.
 */
export async function generateStorePreviews(workspace: Workspace, options: StorePreviewOptions = {}, deps: StorePreviewDeps = {}): Promise<StorePreviewResult> {
  const project = await readProject(workspace);
  if (!project.targets.apple.enabled) throw new GeneratorError('Turn on the App Store in Project to make preview videos');
  let locales: LocaleId[];
  try {
    locales = selectProjectLocales(project.locales, options.locales);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }
  const intro = checkTexts('intro', options.intro, project.locales);
  const outro = checkTexts('outro', options.outro, project.locales);
  const trim = checkTrim(options.trim);
  const cardSeconds = checkCardSeconds(options.cardSeconds);
  if (options.background !== undefined && !isBackground(options.background)) throw new GeneratorError('background must be a solid colour or a gradient');
  const background = options.background ?? DEFAULT_BACKGROUND;

  const videos = (await listInputs(workspace)).filter((input): input is StoredInput & { locale: LocaleId } => input.kind === 'video' && input.locale !== undefined);
  const specs = previewSpecs(project.targets.apple.devices).map(getSpec);
  const result: StorePreviewResult = { entries: [], warnings: [], skipped: [] };
  if (project.targets.apple.devices.some((id) => id.startsWith('apple.screenshot.iphone-duo'))) {
    const size = portraitSize(IPHONE);
    result.warnings.push({
      path: IPHONE,
      message: `iPhone Duo uses the ${size.width} × ${size.height} iPhone preview; Apple has not settled how Duo previews are processed, so treat it as experimental`,
    });
  }

  const work = await mkdtemp(path.join(tmpdir(), 'amc-preview-'));
  const probes = new Map<string, VideoProperties>();
  // Cards and encoded previews by their content: languages that share a recording and their texts share the files.
  const cards = new Map<string, Buffer>();
  const encoded = new Map<string, string>();
  const files: RegisterOptions[] = [];
  const written: LocaleId[] = [];
  try {
    for (const locale of locales) {
      const own = videos.filter((video) => video.locale === locale);
      const fallbackInput = own.length === 0 && locale !== project.sourceLocale;
      const recordings = own.length > 0 ? own : videos.filter((video) => video.locale === project.sourceLocale);
      if (recordings.length === 0) {
        result.skipped.push(locale);
        continue;
      }
      written.push(locale);
      for (const spec of specs) {
        const maxCount = spec.maxCount ?? recordings.length;
        if (recordings.length > maxCount) {
          result.warnings.push({ path: `${locale} ${spec.name}`, message: `Only the first ${maxCount} recordings are used; the App Store takes ${maxCount} previews per size` });
        }
        for (const [index, recording] of recordings.slice(0, maxCount).entries()) {
          const source = path.join(workspace.root, recording.path);
          const label = originalInputName(recording.path);
          try {
            let probe = probes.get(source);
            if (!probe) {
              probe = await probeVideo(source, deps.capture);
              probes.set(source, probe);
            }
            const limits = videoLimits(spec);
            const size = orientedSize(portraitSize(spec.id), probe);
            const plan = planPreview({
              sourceSeconds: probe.durationSeconds,
              ...(trim ? { trim } : {}),
              intro: Boolean(intro[locale]),
              outro: Boolean(outro[locale]),
              cardSeconds,
              minSeconds: limits.minSeconds,
              maxSeconds: limits.maxSeconds,
            });
            const parts: { intro?: Buffer; outro?: Buffer } = {};
            for (const [part, texts] of [
              ['intro', intro],
              ['outro', outro],
            ] as const) {
              const text = texts[locale];
              if (!text) continue;
              const cardKey = JSON.stringify([text, size, background]);
              let png = cards.get(cardKey);
              if (!png) {
                const card = await renderTextCard({ size, text, background });
                png = card.png;
                cards.set(cardKey, png);
                for (const warning of card.warnings) result.warnings.push({ path: `${locale} ${part} card`, message: warning.message });
              }
              parts[part] = png;
            }
            const key = JSON.stringify([source, spec.id, size, plan, intro[locale] ?? '', outro[locale] ?? '', background]);
            let output = encoded.get(key);
            if (!output) {
              output = path.join(work, `${encoded.size + 1}.mp4`);
              const partDir = await mkdtemp(path.join(work, 'cards-'));
              await renderPreview(
                {
                  plan,
                  source,
                  sourceHasAudio: probe.audioChannels !== undefined,
                  size,
                  fps: limits.maxFps ?? 30,
                  padColor: padColorOf(background),
                  output,
                  workDir: partDir,
                  ...parts,
                },
                deps.render,
              );
              const measured = await probeVideo(output, deps.capture);
              const violations = validateMedia(spec, { ...measured, bytes: (await stat(output)).size });
              if (violations.length > 0) throw new Error(`the rendered preview violates ${spec.name}: ${violations.map((v) => v.message).join('; ')}`);
              encoded.set(key, output);
              if (plan.shortened) {
                result.warnings.push({ path: `${locale}/${label}`, message: `The recording was cut to ${plan.clipSeconds} s so the preview stays within ${limits.maxSeconds} s` });
              }
            }
            files.push({ specId: spec.id, locale, order: index + 1, name: label, extension: 'mp4', sourceFile: output, fallbackInput });
          } catch (error) {
            if (error instanceof FfmpegMissingError) throw new GeneratorError(error.message);
            throw new GeneratorError(`${recording.path}: ${(error as Error).message}`);
          }
        }
      }
    }
    if (written.length === 0) throw new GeneratorError(`Upload a screen recording for ${project.sourceLocale} first`);
    // Both sizes are replaced: an iPad preview of a project that no longer uses iPad goes with them.
    result.entries = await registerOutputs(workspace, files, { replaceSets: { specIds: PREVIEW_SPECS, locales: written } });
    return result;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/**
 * One frame of a generated preview as PNG, e.g. to choose the poster frame (App Store Connect sets it per preview; its
 * default is the frame at 5 s). Only files of the manifest that are App Store previews are read, and only within
 * their length.
 */
export async function renderPreviewFrame(workspace: Workspace, outputPath: string, seconds: number, deps: StorePreviewDeps = {}): Promise<Buffer> {
  const entry = (await readManifest(workspace)).entries.find((candidate) => candidate.path === outputPath);
  if (!entry || getSpec(entry.specId).group !== 'preview') throw new GeneratorError('There is no generated preview video at this path');
  const file = path.join(workspace.outputDir, entry.path);
  if ((await locateOutputFile(file, workspace.outputDir)) !== 'own') throw new GeneratorError('The preview video is missing');
  const work = await mkdtemp(path.join(tmpdir(), 'amc-frame-'));
  try {
    const { durationSeconds } = await probeVideo(file, deps.capture);
    if (!Number.isFinite(seconds) || seconds < 0 || seconds >= durationSeconds) {
      throw new GeneratorError(`seconds must be from 0 to below ${Math.round(durationSeconds * 10) / 10} (the length of this preview)`);
    }
    const output = path.join(work, 'frame.png');
    await renderFrame(file, seconds, output, deps.render);
    // ffmpeg ends without a frame when the time lies past the last decodable one.
    if (!(await access(output).then(() => true, () => false))) throw new GeneratorError(`This preview has no frame at ${seconds} s`);
    return await readFile(output);
  } catch (error) {
    if (error instanceof GeneratorError) throw error;
    throw new GeneratorError((error as Error).message);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
