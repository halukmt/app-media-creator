import path from 'node:path';
import type { LocaleId } from '../locales/index.js';
import { SPECS, inspectImage, validateMedia, type MediaProperties, type SpecEntry, type Target } from '../specs/index.js';
import type { ProjectSettings } from '../workspace/project.js';
import { locateOutputFile, type FileLocation, type Manifest, type OutputEntry } from './manifest.js';

export type CheckStatus = 'ok' | 'warning' | 'error';

export interface CheckMessage {
  level: 'error' | 'warning' | 'info';
  text: string;
}

export interface ChecklistItem {
  specId: string;
  name: string;
  required: boolean;
  /** Locale of a localized set; absent for shared assets. */
  locale?: LocaleId;
  status: CheckStatus;
  messages: CheckMessage[];
  /** Output paths of the files in this set. */
  files: string[];
}

export interface TargetChecklist {
  target: Target;
  status: CheckStatus;
  items: ChecklistItem[];
}

export interface Checklist {
  locales: LocaleId[];
  status: CheckStatus;
  targets: TargetChecklist[];
  /** Problems outside any asset, e.g. invalid manifest entries. Each one makes the status an error. */
  problems: string[];
}

/** Measures a file. */
export type MeasureFile = (absolutePath: string) => Promise<MediaProperties>;
/** Locates a registered file: inside the output folder, missing, or a link / file elsewhere. */
export type LocateFile = (absolutePath: string, outputDir: string) => Promise<FileLocation>;

export interface ChecklistInput {
  project: ProjectSettings;
  manifest: Manifest;
  locales: readonly LocaleId[];
  outputDir: string;
  measure?: MeasureFile;
  locate?: LocateFile;
}

const TARGETS: readonly Target[] = ['apple', 'google', 'web'];

function worst(statuses: CheckStatus[]): CheckStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('warning')) return 'warning';
  return 'ok';
}

function statusOf(messages: CheckMessage[]): CheckStatus {
  return worst(messages.map((m) => (m.level === 'info' ? 'ok' : m.level)));
}

async function checkSet(
  spec: SpecEntry,
  files: OutputEntry[],
  chosen: boolean,
  input: ChecklistInput,
  locale?: LocaleId,
): Promise<ChecklistItem> {
  const messages: CheckMessage[] = [];
  const where = locale ? ` for ${locale}` : '';
  const measure = input.measure ?? inspectImage;

  if (files.length === 0) {
    if (spec.required) messages.push({ level: 'error', text: `${spec.name} is required but missing${where}` });
    else messages.push({ level: 'warning', text: `${spec.name} has not been generated yet${where}` });
  } else {
    if (spec.minCount !== undefined && files.length < spec.minCount) {
      messages.push({ level: 'error', text: `At least ${spec.minCount} files are needed${where}; found ${files.length}` });
    }
    if (spec.maxCount !== undefined && files.length > spec.maxCount) {
      messages.push({ level: 'error', text: `At most ${spec.maxCount} files are allowed${where}; found ${files.length}` });
    }
  }

  for (const file of files) {
    const absolute = path.join(input.outputDir, file.path);
    const location = await (input.locate ?? locateOutputFile)(absolute, input.outputDir);
    if (location === 'missing') {
      messages.push({ level: 'error', text: `${file.path}: file is missing` });
    } else if (location === 'foreign') {
      messages.push({ level: 'error', text: `${file.path}: is a link or lies outside the output folder and is not exported` });
    } else if (spec.kind === 'video') {
      messages.push({ level: 'warning', text: `${file.path}: video is not measured yet` });
    } else {
      try {
        for (const violation of validateMedia(spec, await measure(absolute))) {
          messages.push({ level: 'error', text: `${file.path}: ${violation.message}` });
        }
      } catch (error) {
        messages.push({ level: 'error', text: `${file.path}: ${(error as Error).message}` });
      }
    }
    if (file.fallbackInput) {
      messages.push({
        level: 'warning',
        text: `${file.path} was made from the ${input.project.sourceLocale} input because ${locale ?? 'this locale'} has none`,
      });
    }
  }

  if (!spec.verified) {
    messages.push({ level: 'warning', text: 'Size and limits come from third-party sources, not from the store itself' });
  }
  if (spec.condition && chosen) messages.push({ level: 'info', text: spec.condition });

  return {
    specId: spec.id,
    name: spec.name,
    required: spec.required,
    ...(locale ? { locale } : {}),
    status: statusOf(messages),
    messages,
    files: files.map((f) => f.path),
  };
}

/**
 * Builds the export checklist for every enabled target and the selected locales.
 * Scope per target: required assets, device models chosen in the project and every asset with registered files.
 */
export async function buildChecklist(input: ChecklistInput): Promise<Checklist> {
  const targets: TargetChecklist[] = [];

  for (const target of TARGETS) {
    const settings = input.project.targets[target];
    if (!settings.enabled) continue;
    const entries = input.manifest.entries.filter((entry) => entry.specId.startsWith(`${target}.`));
    const registered = new Set(entries.map((entry) => entry.specId));
    const chosen = new Set(settings.devices);
    const specs = SPECS.filter(
      (spec) => spec.target === target && (spec.required || chosen.has(spec.id) || registered.has(spec.id)),
    );

    const items: ChecklistItem[] = [];
    for (const spec of specs) {
      const ofSpec = entries.filter((entry) => entry.specId === spec.id).sort((a, b) => a.order - b.order);
      if (spec.localized) {
        for (const locale of input.locales) {
          items.push(await checkSet(spec, ofSpec.filter((e) => e.locale === locale), chosen.has(spec.id), input, locale));
        }
      } else {
        items.push(await checkSet(spec, ofSpec, chosen.has(spec.id), input));
      }
    }
    targets.push({ target, status: worst(items.map((i) => i.status)), items });
  }

  const problems = [...input.manifest.problems];
  const status = problems.length > 0 ? 'error' : worst(targets.map((t) => t.status));
  return { locales: [...input.locales], status, targets, problems };
}

/** Renders the checklist as Markdown for the ZIP. */
export function checklistMarkdown(checklist: Checklist, projectName: string): string {
  const icon: Record<CheckStatus, string> = { ok: 'OK', warning: 'WARNING', error: 'ERROR' };
  const titles: Record<Target, string> = { apple: 'Apple App Store', google: 'Google Play', web: 'Web and social' };
  const lines = [
    `# Export checklist: ${projectName}`,
    '',
    `Locales: ${checklist.locales.join(', ')}`,
    `Overall: ${icon[checklist.status]}`,
    '',
    ...checklist.problems.map((problem) => `- **ERROR** ${problem}`),
    ...(checklist.problems.length > 0 ? [''] : []),
  ];
  for (const target of checklist.targets) {
    lines.push(`## ${titles[target.target]}: ${icon[target.status]}`, '');
    for (const item of target.items) {
      lines.push(`- **${icon[item.status]}** ${item.name}${item.locale ? ` (${item.locale})` : ''}: ${item.files.length} file(s)`);
      for (const message of item.messages) lines.push(`  - ${message.level}: ${message.text}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
