import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getLocale, isLocaleId, type LocaleId } from '../locales/index.js';
import { getSpec, type SpecEntry } from '../specs/index.js';
import { safeBaseName } from '../workspace/inputs.js';
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

export type FileLocation = 'own' | 'missing' | 'foreign';

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
}

/**
 * Path of a generated file relative to the output folder.
 * Localized: `<target>/<locale>/<segment>/NN-name.ext`; shared: `<target>/shared/<segment>/name.ext`.
 * Throws when a localized asset has no locale or a shared asset gets one.
 */
export function outputPath(spec: SpecEntry, options: OutputPathOptions): string {
  const name = safeBaseName(options.name);
  const extension = options.extension.replace(/^\./, '').toLowerCase();
  if (!/^[a-z0-9]{2,4}$/.test(extension)) throw new Error(`Invalid file extension: ${options.extension}`);
  if (!Number.isInteger(options.order) || options.order < 1 || options.order > 99) {
    throw new Error(`Order must be between 1 and 99, got ${options.order}`);
  }
  if (spec.localized) {
    if (!options.locale) throw new Error(`${spec.id} is localized and needs a locale`);
    const locale = getLocale(options.locale).id;
    const nn = String(options.order).padStart(2, '0');
    return `${spec.target}/${locale}/${segmentFor(spec)}/${nn}-${name}.${extension}`;
  }
  if (options.locale) throw new Error(`${spec.id} is shared and must not have a locale`);
  return `${spec.target}/shared/${segmentFor(spec)}/${name}.${extension}`;
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
    const extension = path.posix.extname(entry.path).slice(1);
    const expected = outputPath(spec, {
      ...(entry.locale ? { locale: entry.locale } : {}),
      order: Number(entry.order),
      name: entry.name,
      extension,
    });
    if (expected !== entry.path) return `${entry.path}: does not match the output layout (expected ${expected})`;
    return {
      specId: spec.id,
      ...(entry.locale ? { locale: entry.locale } : {}),
      order: Number(entry.order),
      name: entry.name,
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

/**
 * Writes a generated file into the output folder and records it in the manifest.
 * A file for the same set position (spec, locale, order) replaces the previous one, even under a new name.
 * Calls run one after another.
 */
export function registerOutput(workspace: Workspace, options: RegisterOptions): Promise<OutputEntry> {
  const run = async (): Promise<OutputEntry> => {
    const spec = getSpec(options.specId);
    const relative = outputPath(spec, options);
    const locale = spec.localized && options.locale ? getLocale(options.locale).id : undefined;
    const target = path.join(workspace.outputDir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, options.bytes);

    const entry: OutputEntry = {
      specId: spec.id,
      ...(locale ? { locale } : {}),
      order: options.order,
      name: safeBaseName(options.name),
      path: relative,
      fallbackInput: options.fallbackInput ?? false,
    };
    const manifest = await readManifest(workspace);
    const samePosition = (e: OutputEntry) =>
      e.path === relative || (e.specId === spec.id && e.locale === locale && e.order === options.order);
    for (const old of manifest.entries.filter(samePosition)) {
      if (old.path !== relative) await rm(path.join(workspace.outputDir, old.path), { force: true });
    }
    const entries = [...manifest.entries.filter((e) => !samePosition(e)), entry].sort((a, b) => a.path.localeCompare(b.path));
    const file = path.join(workspace.outputDir, MANIFEST_FILE);
    const tmp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ version: 1, entries }, null, 2)}\n`, 'utf8');
    await rename(tmp, file);
    return entry;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
