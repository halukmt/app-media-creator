import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getLocale, isLocaleId, type LocaleId } from '../locales/index.js';
import { getSpec, type SpecEntry } from '../specs/index.js';
import { isEnvironmentId } from '../workspace/project.js';
import type { Workspace } from '../workspace/workspace.js';

/** One generated file, registered by the generator that wrote it. */
export interface OutputEntry {
  specId: string;
  /** Media locale for localized assets; absent for shared (text-free) assets. */
  locale?: LocaleId;
  /** Position within its set (1-based); used as the `NN-` prefix of localized files. */
  order: number;
  /** Safe base name without extension. */
  name: string;
  /** Optional folder below the asset folder, e.g. an Android density folder `mipmap-hdpi`. */
  subfolder?: string;
  /** Non-production environment (e.g. `preview`) of an icon variant; absent for production files. */
  environment?: string;
  /** Path relative to the output folder, with forward slashes. */
  path: string;
  /** True when the file was made from the source-language input because the locale had none. */
  fallbackInput: boolean;
}

export interface Manifest {
  version: 1;
  entries: OutputEntry[];
  /** Entries that were dropped because they do not match the output layout (e.g. hand-edited paths). */
  problems: string[];
}

const MANIFEST_FILE = 'manifest.json';

/**
 * Cleans a generated file's base name: lower case, only `[a-z0-9._-]`, no leading or trailing dots or dashes,
 * at most 80 characters. Unlike the upload cleaning it strips nothing as an extension, so it is idempotent and
 * dotted names such as `home.dark` keep their full name.
 */
export function cleanOutputName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[-.]+$/g, '')
    .slice(0, 80)
    .replace(/[-.]+$/g, '');
  return cleaned || 'file';
}

export type FileLocation = 'own' | 'missing' | 'foreign';

/** Throws when a folder resolves (through links) to a place outside the output folder. */
async function assertRealFolderInside(folder: string, outputDir: string): Promise<void> {
  const [real, root] = await Promise.all([realpath(folder), realpath(outputDir)]);
  const relative = path.relative(root, real);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${path.relative(outputDir, folder)} links outside the output folder`);
  }
}

/**
 * Where a registered file really is: 'own' for a regular file inside the output folder, 'missing' when absent,
 * 'foreign' for a symbolic link or a file whose real path is elsewhere (a cloned repo could ship such a link).
 */
export async function locateOutputFile(absolutePath: string, outputDir: string): Promise<FileLocation> {
  let info;
  try {
    info = await lstat(absolutePath);
  } catch {
    return 'missing';
  }
  if (!info.isFile()) return 'foreign';
  try {
    const [real, root] = await Promise.all([realpath(absolutePath), realpath(outputDir)]);
    const relative = path.relative(root, real);
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative) ? 'own' : 'foreign';
  } catch {
    return 'foreign';
  }
}

/**
 * Folder segment of an asset: the device for screenshots (`apple.screenshot.iphone-6.9` → `iphone-6.9`),
 * otherwise the spec id without its target (`google.launcher-icon` → `launcher-icon`,
 * `apple.preview.iphone` → `preview-iphone`). Unique per spec, so assets never overwrite each other.
 */
export function segmentFor(spec: SpecEntry): string {
  if (spec.folder) return spec.folder;
  const tail = spec.id.slice(spec.id.indexOf('.') + 1);
  if (spec.group === 'screenshot') return tail.slice(tail.indexOf('.') + 1);
  // Only the dot after the family becomes a dash; dots in device names (iphone-5.5) stay.
  return tail.replace('.', '-');
}

export interface OutputPathOptions {
  locale?: string;
  order: number;
  name: string;
  extension: string;
  /** One extra folder level below the asset folder: lower-case letters, digits and dashes. */
  subfolder?: string;
  /** Non-production environment: the file goes to `<target>/<environment>/…` instead of `<target>/shared/…`. */
  environment?: string;
}

const SUBFOLDER = /^[a-z0-9][a-z0-9-]{0,40}$/;

/**
 * Path of a generated file relative to the output folder.
 * Localized: `<target>/<locale>/<segment>/NN-name.ext`; shared: `<target>/shared/<segment>/name.ext`; a shared asset of
 * a non-production environment: `<target>/<environment>/<segment>/name.ext` (environments are lower-case, locales are not).
 * Throws when a localized asset has no locale or a shared asset gets one.
 */
export function outputPath(spec: SpecEntry, options: OutputPathOptions): string {
  const name = cleanOutputName(options.name);
  const extension = options.extension.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{2,12}$/.test(extension)) throw new Error(`Invalid file extension: ${options.extension}`);
  if (!Number.isInteger(options.order) || options.order < 1 || options.order > 99) {
    throw new Error(`Order must be between 1 and 99, got ${options.order}`);
  }
  if (options.subfolder !== undefined && !SUBFOLDER.test(options.subfolder)) {
    throw new Error(`Invalid subfolder: ${options.subfolder}`);
  }
  const sub = options.subfolder ? `/${options.subfolder}` : '';
  if (spec.localized) {
    if (options.environment !== undefined) throw new Error(`${spec.id} is localized and has no environment variants`);
    if (!options.locale) throw new Error(`${spec.id} is localized and needs a locale`);
    const locale = getLocale(options.locale).id;
    const nn = String(options.order).padStart(2, '0');
    return `${spec.target}/${locale}/${segmentFor(spec)}${sub}/${nn}-${name}.${extension}`;
  }
  if (options.locale) throw new Error(`${spec.id} is shared and must not have a locale`);
  if (options.environment !== undefined) {
    if (!isEnvironmentId(options.environment)) throw new Error(`Invalid environment: ${options.environment}`);
    return `${spec.target}/${options.environment}/${segmentFor(spec)}${sub}/${name}.${extension}`;
  }
  return `${spec.target}/shared/${segmentFor(spec)}${sub}/${name}.${extension}`;
}

/**
 * Accepts an entry only when its path is exactly what outputPath() gives for its spec, locale, order and name.
 * This keeps every exported path inside the output folder and in the store layout.
 */
function checkEntry(raw: unknown): OutputEntry | string {
  const entry = raw as Partial<OutputEntry>;
  if (typeof entry?.specId !== 'string' || typeof entry.path !== 'string' || typeof entry.name !== 'string') {
    return 'an entry without spec id, name or path';
  }
  try {
    const spec = getSpec(entry.specId);
    if (entry.locale !== undefined && !isLocaleId(entry.locale)) return `${entry.path}: unsupported locale`;
    if (entry.subfolder !== undefined && typeof entry.subfolder !== 'string') return `${entry.path}: subfolder must be text`;
    if (entry.environment !== undefined && typeof entry.environment !== 'string') return `${entry.path}: environment must be text`;
    const extension = path.posix.extname(entry.path).slice(1);
    const expected = outputPath(spec, {
      ...(entry.locale ? { locale: entry.locale } : {}),
      order: Number(entry.order),
      name: entry.name,
      extension,
      ...(entry.subfolder !== undefined ? { subfolder: entry.subfolder } : {}),
      ...(entry.environment !== undefined ? { environment: entry.environment } : {}),
    });
    if (expected !== entry.path) return `${entry.path}: does not match the output layout (expected ${expected})`;
    return {
      specId: spec.id,
      ...(entry.locale ? { locale: entry.locale } : {}),
      order: Number(entry.order),
      name: entry.name,
      ...(entry.subfolder !== undefined ? { subfolder: entry.subfolder } : {}),
      ...(entry.environment !== undefined ? { environment: entry.environment } : {}),
      path: entry.path,
      fallbackInput: entry.fallbackInput === true,
    };
  } catch (error) {
    return `${entry.path}: ${(error as Error).message}`;
  }
}

/** Reads `output/manifest.json`; an absent file is an empty manifest. Invalid entries are dropped and reported. */
export async function readManifest(workspace: Workspace): Promise<Manifest> {
  const file = path.join(workspace.outputDir, MANIFEST_FILE);
  let data: { entries?: unknown };
  try {
    data = JSON.parse(await readFile(file, 'utf8')) as { entries?: unknown };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, entries: [], problems: [] };
    throw new Error(`${file} is not valid JSON`, { cause: error });
  }
  const entries: OutputEntry[] = [];
  const problems: string[] = [];
  for (const raw of Array.isArray(data.entries) ? data.entries : []) {
    const result = checkEntry(raw);
    if (typeof result === 'string') problems.push(`manifest.json: ${result}`);
    else entries.push(result);
  }
  return { version: 1, entries, problems };
}

export interface RegisterOptions extends OutputPathOptions {
  specId: string;
  bytes: Uint8Array;
  fallbackInput?: boolean;
}

let queue: Promise<unknown> = Promise.resolve();

export interface RegisterBatchOptions {
  /**
   * Sets this batch regenerates completely: every earlier entry of these specs and locales that the batch does not
   * write again is removed (with its file), e.g. a position 03 after a screenshot was deleted. Use undefined in
   * `locales` for shared assets. Entries of every environment count, so a batch that writes production and all
   * configured environments also removes the files of an environment that was removed from the project.
   */
  replaceSets?: { specIds: readonly string[]; locales: readonly (LocaleId | undefined)[] };
}

/**
 * Writes generated files into the output folder and records them in the manifest, as one batch:
 * every path is checked first (a path that belongs to another asset rejects the whole batch before anything is
 * written), then all files are written and the manifest is updated once.
 * A file for the same set position (spec, locale, subfolder, order) replaces the previous one, even under a new name.
 * Batches run one after another.
 */
export function registerOutputs(
  workspace: Workspace,
  list: readonly RegisterOptions[],
  batch: RegisterBatchOptions = {},
): Promise<OutputEntry[]> {
  const run = async (): Promise<OutputEntry[]> => {
    const manifest = await readManifest(workspace);
    const planned = list.map((options) => {
      const spec = getSpec(options.specId);
      const relative = outputPath(spec, options);
      const locale = spec.localized && options.locale ? getLocale(options.locale).id : undefined;
      const entry: OutputEntry = {
        specId: spec.id,
        ...(locale ? { locale } : {}),
        order: options.order,
        name: cleanOutputName(options.name),
        ...(options.subfolder !== undefined ? { subfolder: options.subfolder } : {}),
        ...(options.environment !== undefined ? { environment: options.environment } : {}),
        path: relative,
        fallbackInput: options.fallbackInput ?? false,
      };
      return { entry, bytes: options.bytes };
    });

    const paths = new Map<string, string>();
    for (const { entry } of planned) {
      const owner = manifest.entries.find((e) => e.path === entry.path && e.specId !== entry.specId);
      if (owner) throw new Error(`${entry.path} is already registered for ${owner.specId}`);
      const twin = paths.get(entry.path);
      if (twin !== undefined) throw new Error(`${entry.path} is planned twice in one batch (${twin}, ${entry.specId})`);
      paths.set(entry.path, entry.specId);
    }

    // Stage: write every file under a temporary name first. If one write fails, nothing has been replaced yet.
    const staged: { tmp: string; target: string }[] = [];
    try {
      for (const { entry, bytes } of planned) {
        const target = path.join(workspace.outputDir, entry.path);
        await mkdir(path.dirname(target), { recursive: true });
        await assertRealFolderInside(path.dirname(target), workspace.outputDir);
        // A target that exists but is not a regular file would only fail at rename time, after others were replaced.
        const existing = await lstat(target).catch(() => undefined);
        if (existing && !existing.isFile()) throw new Error(`${entry.path} exists and is not a file`);
        const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
        staged.push({ tmp, target });
        await writeFile(tmp, bytes);
      }
    } catch (error) {
      await Promise.all(staged.map(({ tmp }) => rm(tmp, { force: true })));
      throw error;
    }

    let entries = manifest.entries;
    for (const [index, { entry }] of planned.entries()) {
      const { tmp, target } = staged[index]!;
      try {
        await rename(tmp, target);
      } catch (error) {
        // Very unlikely after successful writes; at least leave no temporary files behind.
        await Promise.all(staged.slice(index).map((s) => rm(s.tmp, { force: true })));
        throw error;
      }
      // The subfolder is part of the position: 1x / 2x or density folders hold parallel sets.
      const samePosition = (e: OutputEntry) =>
        e.path === entry.path ||
        (e.specId === entry.specId &&
          e.locale === entry.locale &&
          e.environment === entry.environment &&
          e.subfolder === entry.subfolder &&
          e.order === entry.order);
      for (const old of entries.filter(samePosition)) {
        if (old.path !== entry.path) {
          const oldFile = path.join(workspace.outputDir, old.path);
          // Only delete files that really lie inside the output folder (no links to elsewhere).
          if ((await locateOutputFile(oldFile, workspace.outputDir)) === 'own') await rm(oldFile, { force: true });
        }
      }
      entries = [...entries.filter((e) => !samePosition(e)), entry];
    }

    if (batch.replaceSets) {
      const { specIds, locales } = batch.replaceSets;
      const written = new Set(planned.map(({ entry }) => entry.path));
      const stale = entries.filter((e) => specIds.includes(e.specId) && locales.includes(e.locale) && !written.has(e.path));
      for (const old of stale) {
        const oldFile = path.join(workspace.outputDir, old.path);
        if ((await locateOutputFile(oldFile, workspace.outputDir)) === 'own') await rm(oldFile, { force: true });
      }
      entries = entries.filter((e) => !stale.includes(e));
    }

    entries.sort((a, b) => a.path.localeCompare(b.path));
    const file = path.join(workspace.outputDir, MANIFEST_FILE);
    const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, 'utf8');
    await rename(tmp, file);
    return planned.map((p) => p.entry);
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Registers one generated file; see registerOutputs. */
export async function registerOutput(workspace: Workspace, options: RegisterOptions): Promise<OutputEntry> {
  const [entry] = await registerOutputs(workspace, [options]);
  return entry!;
}
