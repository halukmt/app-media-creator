/**
 * Client for the local JSON API. Types mirror the server responses; the UI never imports server code,
 * because that code depends on Node modules.
 */
import type { CheckStatus } from './lib/export';
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
 * Builds the ZIP for the given locales. Returns it with the `content-disposition` header (file name chosen by the
 * server) and the checklist status the server computed while building it.
 */
export async function downloadExport(
  locales: readonly string[],
): Promise<{ blob: Blob; header: string | null; status: string | null }> {
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ locales }),
  });
  if (!response.ok) throw await apiError(response);
  return {
    blob: await response.blob(),
    header: response.headers.get('content-disposition'),
    status: response.headers.get('x-export-status'),
  };
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

export type LogoPack = 'app-store' | 'google-play' | 'web' | 'social';

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
