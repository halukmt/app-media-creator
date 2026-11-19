import { z } from 'zod';
import { LOCALE_IDS, isLocaleId, resolveLocales, type LocaleId } from '../locales/index.js';
import { SCREENSHOT_MATRIX, type Target } from '../specs/index.js';

export const PROJECT_VERSION = 1;

export interface TargetSettings {
  enabled: boolean;
  /** Screenshot spec ids of this target, e.g. `apple.screenshot.iphone-6.9`. Empty for web. */
  devices: string[];
}

export interface ProjectSettings {
  version: typeof PROJECT_VERSION;
  name: string;
  targets: Record<Target, TargetSettings>;
  sourceLocale: LocaleId;
  locales: LocaleId[];
  claims: { allowed: string[]; forbidden: string[] };
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
  };
}

const claimList = z.array(z.string().trim().min(1).max(200)).max(100);

const targetSchema = z.object({
  enabled: z.boolean(),
  devices: z.array(z.string()).max(50),
});

/** Input schema: accepts the locale selection as "all", one id or a list. */
const projectInputSchema = z.object({
  version: z.literal(PROJECT_VERSION).optional(),
  name: z.string().trim().min(1, 'App name is required').max(100),
  targets: z.object({ apple: targetSchema, google: targetSchema, web: targetSchema }),
  sourceLocale: z.string(),
  locales: z.union([z.string(), z.array(z.string())]),
  claims: z.object({ allowed: claimList, forbidden: claimList }),
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
    },
  };
}
