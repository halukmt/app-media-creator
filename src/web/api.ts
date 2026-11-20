/**
 * Client for the local JSON API. Types mirror the server responses; the UI never imports server code,
 * because that code depends on Node modules.
 */
import type { CheckStatus } from './lib/export';
import { videoRequestBody, type VideoFormat, type VideoPurpose } from './lib/video';
import type { CreativePurpose } from './lib/creative';
import type { TargetId } from './lib/sections';

export interface TargetSettings {
  enabled: boolean;
  devices: string[];
}

export interface ProjectSettings {
  version: 1;
  name: string;
  targets: Record<TargetId, TargetSettings>;
  sourceLocale: string;
  locales: string[];
  claims: { allowed: string[]; forbidden: string[] };
  environments: Environment[];
}

export type EnvironmentColor = 'orange' | 'purple' | 'green' | 'red' | 'blue' | 'gray';
export type EnvironmentStyle = 'badge' | 'blueprint';

/** A non-production install whose icons get a label (mirrors src/core/workspace/project.ts). */
export interface Environment {
  id: string;
  badge: string;
  color: EnvironmentColor;
  style: EnvironmentStyle;
}

export interface CatalogueLocale {
  id: string;
  name: string;
  nativeName: string;
}

export interface CatalogueDevice {
  id: string;
  name: string;
  required: boolean;
  condition?: string;
  size: { width: number; height: number };
}

export interface Catalogue {
  locales: CatalogueLocale[];
  devices: Record<TargetId, CatalogueDevice[]>;
  environmentColors: { id: EnvironmentColor; color: string }[];
  maxEnvironments: number;
  maxBadgeLength: number;
  creativeImages: CatalogueCreativeImage[];
  maxPhrase: number;
  /** Store text fields with their limits (paste order per store). */
  storeTexts: StoreTextSpec[];
  /** The videos the tool writes: render size and allowed length, from the catalogue. */
  videos: { specId: string; name: string; size: { width: number; height: number }; minSeconds: number; maxSeconds: number }[];
}

export type StoreTextField =
  | 'apple-name'
  | 'apple-subtitle'
  | 'apple-promotional-text'
  | 'apple-description'
  | 'apple-keywords'
  | 'apple-whats-new'
  | 'google-title'
  | 'google-short-description'
  | 'google-full-description';

/** One store text field of the catalogue (mirrors core StoreTextSpec). */
export interface StoreTextSpec {
  field: StoreTextField;
  target: 'apple' | 'google';
  name: string;
  order: number;
  fileName: string;
  max: number;
  /** `bytes`: UTF-8 bytes (Apple keywords). */
  unit: 'characters' | 'bytes';
  min?: number;
  required: boolean;
  multiline: boolean;
  verified: boolean;
  sourceUrl: string;
  notes?: string;
}

export interface StoreTextMessage {
  level: 'error' | 'warning';
  text: string;
}

/** The store texts document with the server's check messages per locale and field. */
export interface StoreTexts {
  version: 1;
  revision: number;
  texts: Partial<Record<string, Partial<Record<StoreTextField, string>>>>;
  checks: Partial<Record<string, Partial<Record<StoreTextField, StoreTextMessage[]>>>>;
}

/** One App Store creative image: size and art safe area in pixels (from the spec catalogue). */
export interface CatalogueCreativeImage {
  specId: string;
  name: string;
  group: CreativePurpose;
  target: TargetId;
  /** Whether the phrase is drawn (no own text on in-app event images). */
  text: boolean;
  /** True: the store's art safe area; false: the centred key area of images without one. */
  storeSafeArea: boolean;
  size: { width: number; height: number };
  safeArea: { x: number; y: number; width: number; height: number };
}

/** An API error with the messages the server sent (validation errors or one error text). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
  ) {
    super(messages.join('; ') || `Request failed with status ${status}`);
  }
}

/** The server's messages of a failed request; none for other errors (e.g. a lost connection). */
export function messagesOf(error: unknown): string[] {
  return error instanceof ApiError ? error.messages : [];
}

/** The server refused a save because the stored data changed elsewhere (revision check, 409). */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * The error of a failed response. Validation errors come as `errors`, other failures as `error`;
 * an invalid project.json adds `problems`.
 */
async function apiError(response: Response): Promise<ApiError> {
  const data = ((await response.json().catch(() => null)) ?? {}) as { errors?: unknown; error?: unknown; problems?: unknown };
  const messages = [
    ...(Array.isArray(data.errors) ? data.errors.map(String) : []),
    ...(typeof data.error === 'string' ? [data.error] : []),
    ...(Array.isArray(data.problems) ? data.problems.map(String) : []),
  ];
  return new ApiError(response.status, messages);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw await apiError(response);
  // An empty or non-JSON success body becomes null instead of a SyntaxError.
  return (await response.json().catch(() => null)) as T;
}

export function fetchCatalogue(): Promise<Catalogue> {
  return request<Catalogue>('/api/catalogue');
}

export function fetchProject(): Promise<ProjectSettings> {
  return request<ProjectSettings>('/api/project');
}

export interface ChecklistItem {
  specId: string;
  name: string;
  required: boolean;
  locale?: string;
  environment?: string;
  status: CheckStatus;
  messages: { level: 'error' | 'warning' | 'info'; text: string }[];
  files: string[];
}

export interface Checklist {
  locales: string[];
  status: CheckStatus;
  targets: { target: TargetId; status: CheckStatus; items: ChecklistItem[] }[];
  problems: string[];
}

export function fetchChecklist(locales: readonly string[], signal?: AbortSignal): Promise<Checklist> {
  return request<Checklist>(`/api/export/checklist?locales=${encodeURIComponent(locales.join(','))}`, { signal });
}

/**
 * Builds the ZIP for the locales on the server; answers with its file name, checklist status and a download token.
 * Aborting the signal stops the build (#47).
 */
export function prepareExport(locales: readonly string[], signal?: AbortSignal): Promise<{ token: string; fileName: string; status: string }> {
  return request<{ token: string; fileName: string; status: string }>('/api/export/prepare', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales }),
    ...(signal ? { signal } : {}),
  });
}

/** URL of a prepared ZIP: opened as a plain download, the browser streams it straight to disk. */
export function exportDownloadUrl(token: string): string {
  return `/api/export/download?token=${encodeURIComponent(token)}`;
}

export function saveProject(project: ProjectSettings): Promise<ProjectSettings> {
  return request<ProjectSettings>('/api/project', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(project),
  });
}

export interface StoredInput {
  kind: 'logo' | 'screenshot' | 'video';
  locale?: string;
  path: string;
  format: string;
  bytes: number;
}

export type Background = { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; angle: number };
export type CardLayout = 'text-top' | 'text-top-large' | 'text-bottom';

export interface ScreenshotEntry {
  input: string;
  headline: string;
  subline: string;
  layout?: CardLayout;
  background?: Background;
  frame?: 'device' | 'none';
}

export interface ScreenshotSets {
  version: 1;
  /** Stored version; a save names the revision it is based on (409 when the sets changed elsewhere). */
  revision: number;
  style: { layout: CardLayout; background: Background };
  sets: Partial<Record<string, ScreenshotEntry[]>>;
  known: string[];
}

export interface BackgroundPreset {
  id: string;
  name: string;
  background: Background;
}

export interface CardPreviewResult {
  image: string;
  width: number;
  height: number;
  warnings: { code: string; message: string }[];
  fallbackInput: boolean;
}

export interface CardGenerationResult {
  entries: { path: string; specId: string; locale?: string }[];
  warnings: { code: string; message: string; path: string }[];
  skipped: string[];
}

export function fetchInputs(): Promise<StoredInput[]> {
  return request<StoredInput[]>('/api/inputs');
}

/** URL of an uploaded screenshot for thumbnails. */
export function inputFileUrl(inputPath: string): string {
  return `/api/inputs/file?path=${encodeURIComponent(inputPath)}`;
}

/** Uploads a screen recording (MP4, MOV, M4V) for one media locale. */
export function uploadVideo(file: File, locale: string): Promise<StoredInput> {
  const form = new FormData();
  form.append('file', file);
  form.append('locale', locale);
  return request<StoredInput>('/api/inputs/video', { method: 'POST', body: form });
}

export type { VideoFormat, VideoPurpose };

/** Settings of the Video section, as `/api/video/settings` stores them. */
export interface VideoSettings {
  version: 1;
  purpose: VideoPurpose;
  trim: { start?: number; end?: number };
  intro: Partial<Record<string, string>>;
  outro: Partial<Record<string, string>>;
  cardSeconds: number;
  formats: VideoFormat[];
  frame: string;
  texts: Partial<Record<string, string>>;
}

export function fetchVideoSettings(): Promise<VideoSettings> {
  return request<VideoSettings>('/api/video/settings');
}

export function saveVideoSettings(settings: VideoSettings): Promise<VideoSettings> {
  return request<VideoSettings>('/api/video/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

/** Whether ffmpeg and ffprobe can be started on the machine running the tool. */
export function fetchVideoTools(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  return request<{ ffmpeg: boolean; ffprobe: boolean }>('/api/video/tools');
}

export interface VideoGenerationResult {
  entries: { path: string; specId: string; locale?: string }[];
  warnings: { path: string; message: string }[];
  skipped: string[];
}

const VIDEO_ROUTES: Record<VideoPurpose, string> = {
  'store-preview': '/api/generate/store-previews',
  'device-video': '/api/generate/embed-videos',
  loop: '/api/generate/loop-videos',
};

/** Generates the videos of one purpose for the given locales with the saved settings. */
export function generateVideos(purpose: VideoPurpose, locales: readonly string[], settings: VideoSettings): Promise<VideoGenerationResult> {
  return request<VideoGenerationResult>(VIDEO_ROUTES[purpose], {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(videoRequestBody(purpose, locales, settings)),
  });
}

/** The generated files (manifest entries). */
export function fetchOutputs(): Promise<{ path: string; specId: string; locale?: string; fallbackInput: boolean }[]> {
  return request<{ path: string; specId: string; locale?: string; fallbackInput: boolean }[]>('/api/output');
}

/** URL of a generated MP4 for a `<video>` preview; `version` changes after a new render. */
export function outputVideoUrl(outputPath: string, version: number): string {
  return `/api/output/file?path=${encodeURIComponent(outputPath)}&v=${version}`;
}

export function uploadScreenshot(file: File, locale: string): Promise<StoredInput> {
  const form = new FormData();
  form.append('file', file);
  form.append('locale', locale);
  return request<StoredInput>('/api/inputs/screenshot', { method: 'POST', body: form });
}

export function fetchScreenshots(): Promise<ScreenshotSets> {
  return request<ScreenshotSets>('/api/screenshots');
}

export function saveScreenshots(sets: ScreenshotSets): Promise<ScreenshotSets> {
  return request<ScreenshotSets>('/api/screenshots', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sets),
  });
}

export function fetchStoreTexts(): Promise<StoreTexts> {
  return request<StoreTexts>('/api/store-texts');
}

/** Saves the texts; the server rejects a stale `revision` with 409 (ApiError status 409). */
export function saveStoreTexts(document: Pick<StoreTexts, 'version' | 'revision' | 'texts'>): Promise<StoreTexts> {
  return request<StoreTexts>('/api/store-texts', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ version: document.version, revision: document.revision, texts: document.texts }),
  });
}

export function fetchBackgrounds(): Promise<{ presets: BackgroundPreset[]; palette: BackgroundPreset[] }> {
  return request('/api/screenshots/backgrounds');
}

export function previewCard(locale: string, device: string, index: number, signal?: AbortSignal): Promise<CardPreviewResult> {
  return request<CardPreviewResult>('/api/screenshots/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locale, device, index }),
    ...(signal ? { signal } : {}),
  });
}

export function generateScreenshotCards(locales: readonly string[]): Promise<CardGenerationResult> {
  return request<CardGenerationResult>('/api/generate/screenshot-cards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales }),
  });
}

export function generateFramedScreenshots(locales: readonly string[], frame: string, shadow: boolean): Promise<{ path: string }[]> {
  return request('/api/generate/framed-screenshots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales, frame, shadow }),
  });
}

export type LogoPack = 'app-store' | 'google-play' | 'expo' | 'web' | 'social';

export interface LogoSettings {
  version: 1;
  packs: LogoPack[];
  background: string;
  taglines: Partial<Record<string, string>>;
}

export interface LogoOutput {
  path: string;
  specId: string;
  name: string;
  locale?: string;
  environment?: string;
  pack: LogoPack;
  width?: number;
  height?: number;
}

export interface PackResult {
  entries: { path: string }[];
  warnings: { code: string; message: string; path: string }[];
}

export function uploadLogo(file: File): Promise<StoredInput> {
  const form = new FormData();
  form.append('file', file);
  return request<StoredInput>('/api/inputs/logo', { method: 'POST', body: form });
}

/** URL of the newest logo as a PNG; `version` changes after an upload so the browser loads it again. */
export function logoPreviewUrl(version: number): string {
  return `/api/inputs/logo-preview?v=${version}`;
}

/** URL of a generated image, scaled to `width` for previews; `version` changes after each generate run. */
export function outputFileUrl(outputPath: string, width: number, version: number): string {
  return `/api/output/file?path=${encodeURIComponent(outputPath)}&width=${width}&v=${version}`;
}

export function fetchLogoSettings(): Promise<LogoSettings> {
  return request<LogoSettings>('/api/logo/settings');
}

export function saveLogoSettings(settings: LogoSettings): Promise<LogoSettings> {
  return request<LogoSettings>('/api/logo/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export function fetchLogoOutputs(): Promise<LogoOutput[]> {
  return request<LogoOutput[]>('/api/logo/output');
}

export function generateLogoPack(pack: LogoPack, locales: readonly string[]): Promise<PackResult> {
  return request<PackResult>(`/api/generate/logo/${pack}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales }),
  });
}

/** Settings of the App Store header and search images (mirrors core CreativeSettings). */
export interface CreativeSettings {
  version: 1;
  background: Background;
  phrases: Partial<Record<string, string>>;
}

/** A small render of one creative image; `safeArea` is given as shares (0 to 1) of the image size. */
export interface CreativePreviewResult {
  image: string;
  width: number;
  height: number;
  /** Pixel size of the real asset and of its safe area. */
  full: { width: number; height: number; safeWidth: number; safeHeight: number };
  safeArea: { x: number; y: number; width: number; height: number };
  warnings: { code: string; message: string }[];
  fallbackInput: boolean;
}

export function fetchCreativeSettings(): Promise<CreativeSettings> {
  return request<CreativeSettings>('/api/creative/settings');
}

export function saveCreativeSettings(settings: CreativeSettings): Promise<CreativeSettings> {
  return request<CreativeSettings>('/api/creative/settings', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

export function previewCreative(locale: string, specId: string, width: number, signal?: AbortSignal): Promise<CreativePreviewResult> {
  return request<CreativePreviewResult>('/api/creative/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locale, specId, width }),
    ...(signal ? { signal } : {}),
  });
}

export function generateCreativeAssets(locales: readonly string[], group: CreativePurpose): Promise<CardGenerationResult> {
  return request<CardGenerationResult>('/api/generate/creative-assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales, group }),
  });
}

/** One variant of a screenshot headline. */
export interface CopyText {
  headline: string;
  subline: string;
}

/** An AI job folder as the server reports it (mirrors core JobState). */
export type AiJobTask = 'copy' | 'store-texts';

export interface AiJob {
  id: string;
  task: AiJobTask;
  createdAt: string;
  locales: string[];
  folder: string;
  /** What to run in Claude Code. */
  command: string;
  status: 'waiting' | 'ready' | 'invalid' | 'applied';
  errors: string[];
  warnings: string[];
  headlines?: { version: 1; locales: Partial<Record<string, { slots: { input: string; A: CopyText; B: CopyText }[] }>> };
  /** Store text jobs: the texts the AI wrote, per locale and field. */
  storeTexts?: Partial<Record<string, Partial<Record<StoreTextField, string>>>>;
  /** When the current result was applied; `variant` for headline jobs. */
  applied?: { variant?: 'A' | 'B'; at: string };
}

/** Jobs of one task, newest first; `limit` reads only that many (a section needs its newest one). */
export function fetchJobs(task: AiJobTask, limit?: number): Promise<AiJob[]> {
  return request<AiJob[]>(`/api/jobs?task=${task}${limit ? `&limit=${limit}` : ''}`);
}

export function fetchJob(id: string): Promise<AiJob> {
  return request<AiJob>(`/api/jobs/${encodeURIComponent(id)}`);
}

export function createJob(task: AiJobTask, locales: readonly string[]): Promise<AiJob> {
  return request<AiJob>('/api/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task, locales }),
  });
}

/** Applies a job: one variant of a headline job, or all texts of a store texts job (no variant). */
export function applyJob(id: string, variant?: 'A' | 'B'): Promise<{ locales: string[] }> {
  return request<{ locales: string[] }>(`/api/jobs/${encodeURIComponent(id)}/apply`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(variant ? { variant } : {}),
  });
}

/** Path of the live event stream: event `job` with the id of a job whose files changed. */
export const JOB_EVENTS_URL = '/api/jobs/events';
