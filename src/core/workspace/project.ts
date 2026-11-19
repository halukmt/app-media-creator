import { z } from 'zod';
import { LOCALE_IDS, isLocaleId, resolveLocales, type LocaleId } from '../locales/index.js';
import { SCREENSHOT_MATRIX, type Target } from '../specs/index.js';

export const PROJECT_VERSION = 1;

export interface TargetSettings {
  enabled: boolean;
  /** Screenshot spec ids of this target, e.g. `apple.screenshot.iphone-6.9`. Empty for web. */
  devices: string[];
}

/** Colour presets of environment badges (no free colour picker). */
export const ENVIRONMENT_COLORS = {
  orange: '#c2410c',
  purple: '#7c3aed',
  green: '#15803d',
  red: '#b91c1c',
  blue: '#1d4ed8',
  gray: '#4b5563',
} as const;
export type EnvironmentColor = keyof typeof ENVIRONMENT_COLORS;
export const ENVIRONMENT_STYLES = ['badge', 'blueprint'] as const;
export type EnvironmentStyle = (typeof ENVIRONMENT_STYLES)[number];
export const MAX_ENVIRONMENTS = 5;
export const MAX_BADGE_LENGTH = 10;

/**
 * A non-production install (preview, dev, beta) whose icons must look different from the production app. Production
 * is implicit and always uses the normal icons.
 */
export interface Environment {
  /** Folder name in the export: lower-case letters, digits and dashes; not "production" or "shared". */
  id: string;
  /** Short text on the icon, e.g. PREVIEW, DEV, BETA. */
  badge: string;
  color: EnvironmentColor;
  style: EnvironmentStyle;
}

export function defaultEnvironments(): Environment[] {
  return [{ id: 'preview', badge: 'PREVIEW', color: 'orange', style: 'badge' }];
}

const ENVIRONMENT_ID = /^[a-z][a-z0-9-]{0,19}$/;
const RESERVED_ENVIRONMENTS = new Set(['production', 'shared']);

export function isEnvironmentId(value: string): boolean {
  return ENVIRONMENT_ID.test(value) && !RESERVED_ENVIRONMENTS.has(value);
}

export interface ProjectSettings {
  version: typeof PROJECT_VERSION;
  name: string;
  targets: Record<Target, TargetSettings>;
  sourceLocale: LocaleId;
  locales: LocaleId[];
  claims: { allowed: string[]; forbidden: string[] };
  /** Non-production environments with their own icon variants. */
  environments: Environment[];
}

/** Screenshot spec ids a target offers as device models: the device matrix the card renderer supports. */
export function deviceOptions(target: Target): string[] {
  return [...SCREENSHOT_MATRIX[target]];
}

export function defaultProject(name = 'My app'): ProjectSettings {
  return {
    version: PROJECT_VERSION,
    name,
    targets: {
      apple: { enabled: true, devices: ['apple.screenshot.iphone-6.9', 'apple.screenshot.iphone-6.3'] },
      google: { enabled: true, devices: ['google.screenshot.phone'] },
      web: { enabled: true, devices: [] },
    },
    sourceLocale: 'en-US',
    locales: [...LOCALE_IDS],
    claims: { allowed: [], forbidden: [] },
    environments: defaultEnvironments(),
  };
}

const claimList = z.array(z.string().trim().min(1).max(200)).max(100);

const targetSchema = z.object({
  enabled: z.boolean(),
  devices: z.array(z.string()).max(50),
});

const environmentSchema = z.object({
  id: z.string().trim().toLowerCase().refine(isEnvironmentId, 'must be lower-case letters, digits or dashes, start with a letter, and not be "production" or "shared"'),
  badge: z.string().trim().toUpperCase().min(1, 'Badge text is required').max(MAX_BADGE_LENGTH, `at most ${MAX_BADGE_LENGTH} characters`),
  color: z.enum(Object.keys(ENVIRONMENT_COLORS) as [EnvironmentColor, ...EnvironmentColor[]]),
  style: z.enum(ENVIRONMENT_STYLES),
});

/** Input schema: accepts the locale selection as "all", one id or a list. */
const projectInputSchema = z.object({
  version: z.literal(PROJECT_VERSION).optional(),
  name: z.string().trim().min(1, 'App name is required').max(100),
  targets: z.object({ apple: targetSchema, google: targetSchema, web: targetSchema }),
  sourceLocale: z.string(),
  locales: z.union([z.string(), z.array(z.string())]),
  claims: z.object({ allowed: claimList, forbidden: claimList }),
  /** Absent in project files written before environments existed: the default list. */
  environments: z.array(environmentSchema).max(MAX_ENVIRONMENTS).optional(),
});

export type ProjectValidation = { ok: true; project: ProjectSettings } | { ok: false; errors: string[] };

/**
 * Validates unknown input (an API body or a parsed project.json) and returns normalized settings
 * or one message per invalid field. Never throws.
 */
export function validateProject(input: unknown): ProjectValidation {
  const parsed = projectInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'project'}: ${issue.message}`),
    };
  }

  const data = parsed.data;
  const errors: string[] = [];

  let locales: LocaleId[] = [];
  try {
    locales = resolveLocales(data.locales);
  } catch (error) {
    errors.push(`locales: ${(error as Error).message}`);
  }

  if (!isLocaleId(data.sourceLocale)) {
    errors.push(`sourceLocale: ${data.sourceLocale} is not a supported locale`);
  } else if (locales.length > 0 && !locales.includes(data.sourceLocale)) {
    errors.push(`sourceLocale: ${data.sourceLocale} must be one of the selected locales`);
  }

  for (const target of ['apple', 'google', 'web'] as const) {
    const allowed = deviceOptions(target);
    for (const device of data.targets[target].devices) {
      if (!allowed.includes(device)) errors.push(`targets.${target}.devices: ${device} is not a ${target} device`);
    }
  }

  const environments = data.environments ?? defaultEnvironments();
  const ids = environments.map((environment) => environment.id);
  for (const [index, id] of ids.entries()) {
    if (ids.indexOf(id) !== index) errors.push(`environments.${index}.id: ${id} is used twice`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const unique = (list: string[]) => [...new Set(list)];
  return {
    ok: true,
    project: {
      version: PROJECT_VERSION,
      name: data.name,
      targets: {
        apple: { enabled: data.targets.apple.enabled, devices: unique(data.targets.apple.devices) },
        google: { enabled: data.targets.google.enabled, devices: unique(data.targets.google.devices) },
        web: { enabled: data.targets.web.enabled, devices: unique(data.targets.web.devices) },
      },
      sourceLocale: data.sourceLocale as LocaleId,
      locales,
      claims: { allowed: unique(data.claims.allowed), forbidden: unique(data.claims.forbidden) },
      environments,
    },
  };
}
