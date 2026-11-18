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
  return (await response.json()) as T;
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
