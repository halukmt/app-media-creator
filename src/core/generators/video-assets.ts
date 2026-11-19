import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { registerOutputs, type OutputEntry, type RegisterOptions } from '../export/manifest.js';
import { selectProjectLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { isBackground, type Background } from '../screenshots/backgrounds.js';
import { keyScreen, renderCreativeAsset } from '../screenshots/creative.js';
import { isFrameKind, loadUserFrame, type FrameKind } from '../screenshots/frames.js';
import { getSpec, type Size, type SpecEntry } from '../specs/index.js';
import {
  EMBED_FORMATS,
  EMBED_SPECS,
  LOOP_FADE,
  isEmbedFormat,
  overlayPng,
  planClip,
  planLoop,
  renderComposite,
  renderEmbedLayers,
  screenPixels,
  type EmbedFormat,
} from '../video/compose.js';
import { renderFrame } from '../video/preview.js';
import { FfmpegMissingError, type CaptureProgram, type RunProgram } from '../video/tools.js';
import { MAX_PHRASE, originalInputName, readCreativeSettings, readProject, type Workspace } from '../workspace/index.js';
import { CREATIVE_IMAGES, creativeGeometry } from './creative-assets.js';
import { GeneratorError } from './logo.js';
import { fixedSizes } from './outputs.js';
import { assertRenderedVideo, checkLocaleTexts, checkTrim, probeCache, recordingsFor, videoLimits, type LocaleRecordings, type Recording } from './recordings.js';

/**
 * Videos built from a screen recording on a styled background (#21): device videos for web and social (9:16, 16:9,
 * 1:1) with an optional line of text per language, and the App Store's looping product page header and search
 * videos, laid out like the header and search images (#18) with the recording playing in the key-art device.
 */

export interface VideoAssetWarning {
  path: string;
  message: string;
}

export interface VideoAssetResult {
  entries: OutputEntry[];
  warnings: VideoAssetWarning[];
  /** Languages without a recording of their own or of the source language. */
  skipped: LocaleId[];
}

/** Programs the generators start; injectable for tests. */
export interface VideoAssetDeps {
  render?: RunProgram;
  capture?: CaptureProgram;
}

export interface EmbedVideoOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
  /** Formats to write; default all three. Only these formats are replaced. */
  formats?: readonly EmbedFormat[];
  /** Device frame around the recording (default `iphone`). */
  frame?: FrameKind;
  /** One line of text per language above (or beside) the device. */
  texts?: Partial<Record<string, string>>;
  /** Background; default the background of the header and search images. */
  background?: Background;
  /** Part of every recording to use, in seconds. */
  trim?: { start?: number; end?: number };
}

export interface LoopVideoOptions {
  /** Languages to generate: "all", one or several; default all languages of the project. */
  locales?: LocaleSelection;
  /** Part of the recording to use, in seconds. */
  trim?: { start?: number; end?: number };
}

const HEADER = 'apple.creative.header-video';
const SEARCH = 'apple.creative.search-video';
/** The image each loop video takes its layout from (safe area, key-art area). */
const LAYOUT_IMAGE: Record<string, string> = { [HEADER]: 'apple.creative.header-image', [SEARCH]: 'apple.creative.search-image' };

/** The frame rate a video of this entry is written at: the first allowed rate, or the maximum. */
function fpsFor(spec: SpecEntry): number {
  const limits = videoLimits(spec);
  return limits.allowedFps?.[0] ?? limits.maxFps ?? 30;
}

/** Usable length of a recording: the video track's, which can end before the container (#21 review). */
const usableSeconds = (measured: { durationSeconds: number; videoSeconds?: number }) => Math.min(measured.durationSeconds, measured.videoSeconds ?? Infinity);

function projectLocales(all: readonly LocaleId[], selection: LocaleSelection | undefined): LocaleId[] {
  try {
    return selectProjectLocales(all, selection);
  } catch (error) {
    throw new GeneratorError((error as Error).message);
  }
}

/** An encoded video and the warnings it came with; reused by every language that would encode the same one. */
interface Encoded {
  file: string;
  warnings: string[];
}

/** Shared run: a temp folder, the per-language loop, error mapping, and one registration at the end. */
async function runVideos(
  workspace: Workspace,
  recordings: { perLocale: LocaleRecordings[]; skipped: LocaleId[] },
  sourceLocale: LocaleId,
  specIds: readonly string[],
  render: (work: string, entry: LocaleRecordings, files: RegisterOptions[], warnings: VideoAssetWarning[]) => Promise<void>,
): Promise<VideoAssetResult> {
  const { perLocale, skipped } = recordings;
  if (perLocale.length === 0) throw new GeneratorError(`Upload a screen recording for ${sourceLocale} first`);
  const work = await mkdtemp(path.join(tmpdir(), 'amc-video-'));
  const files: RegisterOptions[] = [];
  const warnings: VideoAssetWarning[] = [];
  try {
    for (const entry of perLocale) {
      try {
        await render(work, entry, files, warnings);
      } catch (error) {
        if (error instanceof GeneratorError) throw error;
        if (error instanceof FfmpegMissingError) throw new GeneratorError(error.message);
        throw new GeneratorError(`${entry.locale}: ${(error as Error).message}`);
      }
    }
    const entries = await registerOutputs(workspace, files, { replaceSets: { specIds, locales: perLocale.map((entry) => entry.locale) } });
    return { entries, warnings, skipped };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

/** Runs `make` once per key; every caller gets the file and adds the warnings under its own path. */
async function encodeOnce(cache: Map<string, Encoded>, key: string, make: () => Promise<Encoded>, report: (message: string) => void): Promise<string> {
  let encoded = cache.get(key);
  if (!encoded) {
    encoded = await make();
    cache.set(key, encoded);
  }
  for (const message of encoded.warnings) report(message);
  return encoded.file;
}

/**
 * Device videos for web and social: per language and format, each recording (up to the catalogue count) in a device
 * frame on the background, with the language's text. Identical videos (same recording, format and text) are encoded
 * once. The recording's own audio is kept; without it the video has none.
 */
export async function generateEmbedVideos(workspace: Workspace, options: EmbedVideoOptions = {}, deps: VideoAssetDeps = {}): Promise<VideoAssetResult> {
  const project = await readProject(workspace);
  if (!project.targets.web.enabled) throw new GeneratorError('Turn on Web in Project to make device videos');
  const locales = projectLocales(project.locales, options.locales);
  const formats = options.formats ?? EMBED_FORMATS;
  if (!Array.isArray(formats) || formats.length === 0 || !formats.every(isEmbedFormat)) {
    throw new GeneratorError(`formats must be a list of ${EMBED_FORMATS.join(', ')}`);
  }
  const frame = options.frame ?? 'iphone';
  if (!isFrameKind(frame)) throw new GeneratorError(`Unknown frame: ${String(frame)}`);
  const texts = checkLocaleTexts('texts', options.texts, project.locales, MAX_PHRASE);
  const trim = checkTrim(options.trim);
  if (options.background !== undefined && !isBackground(options.background)) throw new GeneratorError('background must be a solid colour or a gradient');
  const background = options.background ?? (await readCreativeSettings(workspace)).background;

  const probe = probeCache(deps.capture);
  const encoded = new Map<string, Encoded>();
  const specIds = formats.map((format) => EMBED_SPECS[format]);
  return runVideos(workspace, await recordingsFor(workspace, project, locales), project.sourceLocale, specIds, async (work, { locale, recordings, fallbackInput }, files, warnings) => {
    for (const format of formats) {
      const spec = getSpec(EMBED_SPECS[format]);
      const limits = videoLimits(spec);
      const [size] = fixedSizes(spec.id) as [Size];
      const maxCount = spec.maxCount ?? recordings.length;
      if (recordings.length > maxCount) warnings.push({ path: `${locale} ${spec.name}`, message: `Only the first ${maxCount} recordings are used` });
      for (const [index, recording] of recordings.slice(0, maxCount).entries()) {
        const name = originalInputName(recording.path);
        const text = texts[locale] ?? '';
        const file = await encodeOnce(
          encoded,
          JSON.stringify([recording.file, format, text]),
          async () => {
            const measured = await probe(recording.file);
            const plan = planClip({ sourceSeconds: usableSeconds(measured), ...(trim ? { trim } : {}), minSeconds: limits.minSeconds, maxSeconds: limits.maxSeconds });
            const layers = await renderEmbedLayers({ format, size, kind: frame, screenAspect: measured.height / measured.width, text, background });
            const output = path.join(work, `embed-${encoded.size + 1}.mp4`);
            const fps = Math.min(fpsFor(spec), Math.round(measured.fps) || 30);
            await renderComposite(
              { layers, workDir: await mkdtemp(path.join(work, 'layers-')), source: recording.file, screen: layers.screen, size, fps, plan, loop: false, audio: measured.audioChannels !== undefined, output },
              deps.render,
            );
            await assertRenderedVideo(spec, output, deps.capture);
            const notes = layers.warnings.map((warning) => warning.message);
            if (plan.shortened) notes.push(`${name}: the recording was cut to ${plan.clipSeconds} s`);
            return { file: output, warnings: notes };
          },
          (message) => warnings.push({ path: `${locale} ${spec.name}`, message }),
        );
        files.push({ specId: spec.id, locale, order: index + 1, name, extension: 'mp4', sourceFile: file, fallbackInput });
      }
    }
  });
}

/** Size and safe area of a loop video: the layout of its image, at the smallest size the video entry allows. */
function loopCanvas(specId: string): { size: Size; safeArea: { x: number; y: number; width: number; height: number } } {
  const spec = getSpec(specId);
  const image = CREATIVE_IMAGES.find((candidate) => candidate.specId === LAYOUT_IMAGE[specId]);
  if (!image) throw new Error(`${specId} has no layout image`);
  const width = spec.dimensions.kind === 'fixed' ? spec.dimensions.sizes[0]!.width : spec.dimensions.kind === 'range' ? spec.dimensions.min?.width : undefined;
  if (width === undefined) throw new Error(`${specId} has no usable size`);
  const geometry = creativeGeometry(image, width);
  return { size: { width: geometry.width, height: geometry.height }, safeArea: geometry.safeArea };
}

/**
 * The App Store's looping product page header and search results videos: the header / search layout with the phrase
 * of the language and the recording playing in the key-art device, joined end to start with a crossfade so it loops
 * without a jump. No audio: the App Store plays them muted. One per language (the first recording).
 */
export async function generateLoopVideos(workspace: Workspace, options: LoopVideoOptions = {}, deps: VideoAssetDeps = {}): Promise<VideoAssetResult> {
  const project = await readProject(workspace);
  if (!project.targets.apple.enabled) throw new GeneratorError('Turn on the App Store in Project to make header and search videos');
  const locales = projectLocales(project.locales, options.locales);
  const trim = checkTrim(options.trim);
  const settings = await readCreativeSettings(workspace);
  const userFrame = await loadUserFrame(workspace.userFramesDir, 'iphone').catch((error: unknown) => {
    throw new GeneratorError(`frames/user/iphone: ${(error as Error).message}`);
  });

  const probe = probeCache(deps.capture);
  const encoded = new Map<string, Encoded>();
  // The loop's first frame, as a still for the plate: once per recording and start.
  const stills = new Map<string, Promise<Buffer>>();
  const stillOf = (work: string, recording: Recording, seconds: number) => {
    const key = JSON.stringify([recording.file, seconds]);
    let still = stills.get(key);
    if (!still) {
      still = (async () => {
        const file = path.join(await mkdtemp(path.join(work, 'still-')), 'still.png');
        await renderFrame(recording.file, seconds, file, deps.render);
        return readFile(file);
      })();
      stills.set(key, still);
    }
    return still;
  };

  const specIds = [HEADER, SEARCH];
  return runVideos(workspace, await recordingsFor(workspace, project, locales), project.sourceLocale, specIds, async (work, { locale, recordings, fallbackInput }, files, warnings) => {
    const recording = recordings[0]!;
    if (recordings.length > 1) warnings.push({ path: locale, message: 'Header and search videos use the first recording of the language' });
    const phrase = settings.phrases[locale] ?? '';
    for (const specId of specIds) {
      const spec = getSpec(specId);
      const limits = videoLimits(spec);
      const file = await encodeOnce(
        encoded,
        JSON.stringify([recording.file, specId, phrase]),
        async () => {
          const measured = await probe(recording.file);
          const plan = planLoop({ sourceSeconds: usableSeconds(measured), ...(trim ? { trim } : {}), minSeconds: limits.minSeconds, maxSeconds: limits.maxSeconds });
          const { size, safeArea } = loopCanvas(specId);
          // The plate shows the loop's first frame (the crossfade starts the loop at clipStart + LOOP_FADE).
          const screenshot = await stillOf(work, recording, plan.clipStart + LOOP_FADE);
          const drawn = await renderCreativeAsset({ ...size, safeArea, background: settings.background, phrase, screenshots: [screenshot], userFrame });
          const key = keyScreen(drawn.key, userFrame);
          const output = path.join(work, `loop-${encoded.size + 1}.mp4`);
          await renderComposite(
            {
              layers: { plate: drawn.png, overlay: await overlayPng(size, key.overlay) },
              workDir: await mkdtemp(path.join(work, 'layers-')),
              source: recording.file,
              screen: screenPixels(key.screen),
              size,
              fps: fpsFor(spec),
              plan,
              loop: true,
              audio: false,
              output,
            },
            deps.render,
          );
          await assertRenderedVideo(spec, output, deps.capture);
          const notes = drawn.warnings.map((warning) => warning.message);
          if (plan.shortened) notes.push(`The recording was cut so the loop stays within ${limits.maxSeconds} s`);
          return { file: output, warnings: notes };
        },
        (message) => warnings.push({ path: `${locale} ${spec.name}`, message }),
      );
      files.push({ specId, locale, order: 1, name: specId === HEADER ? 'header' : 'search', extension: 'mp4', sourceFile: file, fallbackInput });
    }
    if (!phrase) warnings.push({ path: locale, message: `No phrase for ${locale}: the videos show the device alone` });
  });
}
