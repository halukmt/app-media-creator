/**
 * Client for the local JSON API. Types mirror the server responses; the UI never imports server code,
 * because that code depends on Node modules.
 */
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data = (body ?? {}) as { errors?: unknown; error?: unknown };
    const messages = Array.isArray(data.errors)
      ? data.errors.map(String)
      : typeof data.error === 'string'
        ? [data.error]
        : [];
    throw new ApiError(response.status, messages);
  }
  return body as T;
}

export function fetchCatalogue(): Promise<Catalogue> {
  return request<Catalogue>('/api/catalogue');
}

export function fetchProject(): Promise<ProjectSettings> {
  return request<ProjectSettings>('/api/project');
}

export function saveProject(project: ProjectSettings): Promise<ProjectSettings> {
  return request<ProjectSettings>('/api/project', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(project),
  });
}
