import { randomBytes } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { getLocale, type LocaleId } from '../locales/index.js';
import type { Workspace } from './workspace.js';

export type InputKind = 'logo' | 'screenshot' | 'video';

const MB = 1024 * 1024;

interface KindRule {
  folder: string;
  maxBytes: number;
  formats: readonly string[];
  perLocale: boolean;
}

export const INPUT_RULES: Record<InputKind, KindRule> = {
  logo: { folder: 'logo', maxBytes: 10 * MB, formats: ['png', 'jpeg', 'webp', 'svg'], perLocale: false },
  screenshot: { folder: 'screenshots', maxBytes: 20 * MB, formats: ['png', 'jpeg', 'webp'], perLocale: true },
  video: { folder: 'videos', maxBytes: 500 * MB, formats: ['mp4', 'mov', 'm4v'], perLocale: true },
};

const EXTENSIONS: Record<string, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  svg: 'svg',
  mp4: 'mp4',
  mov: 'mov',
  m4v: 'm4v',
};

export function isInputKind(value: string): value is InputKind {
  return value === 'logo' || value === 'screenshot' || value === 'video';
}

export class InputError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415 = 400,
  ) {
    super(message);
  }
}

/** ISO base media brands of MP4 video. HEIC, AVIF, M4A and 3GP use other brands and are not videos here. */
const MP4_BRANDS = new Set(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'dash', 'msnv']);
/** First atoms of QuickTime files that start without an `ftyp` box (older cameras and editors). */
const QUICKTIME_LEADING_ATOMS = new Set(['moov', 'mdat', 'wide', 'free', 'skip', 'pnot']);

const ascii = (bytes: Uint8Array, start: number, end: number) => Buffer.from(bytes.subarray(start, end)).toString('latin1');

/** Detects MP4, MOV or M4V from the leading box; returns undefined for anything else. */
function detectVideoFormat(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12) return undefined;
  const box = ascii(bytes, 4, 8);
  if (QUICKTIME_LEADING_ATOMS.has(box)) return 'mov';
  if (box !== 'ftyp') return undefined;

  const major = ascii(bytes, 8, 12);
  if (major === 'qt  ') return 'mov';
  if (major.startsWith('M4V')) return 'm4v';
  if (MP4_BRANDS.has(major)) return 'mp4';

  // Unknown major brand: accept only when a compatible brand marks it as MP4 video.
  const boxSize = Buffer.from(bytes.subarray(0, 4)).readUInt32BE(0);
  const end = Math.min(boxSize, bytes.length);
  const compatible: string[] = [];
  for (let offset = 16; offset + 4 <= end; offset += 4) compatible.push(ascii(bytes, offset, offset + 4));
  const imageOrAudio = compatible.some((brand) => ['mif1', 'msf1', 'heic', 'avif', 'M4A '].includes(brand));
  return !imageOrAudio && compatible.some((brand) => MP4_BRANDS.has(brand)) ? 'mp4' : undefined;
}

/** Detects the real file format from the content. Returns undefined for unknown content. */
export async function detectFormat(bytes: Uint8Array): Promise<string | undefined> {
  const video = detectVideoFormat(bytes);
  if (video) return video;
  try {
    const metadata = await sharp(bytes).metadata();
    return metadata.format;
  } catch {
    return undefined;
  }
}

/** Turns a user-provided file name into a safe base name without extension. */
export function safeBaseName(originalName: string): string {
  const base = path.basename(originalName.replace(/\\/g, '/')).replace(/\.[^.]*$/, '');
  const cleaned = base
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[.-]+|[-.]+$/g, '');
  return cleaned.slice(0, 80) || 'file';
}

export interface StoredInput {
  kind: InputKind;
  /** Locale folder for screenshots and videos; undefined for the logo. */
  locale?: LocaleId;
  /** Path relative to the workspace root, with forward slashes. */
  path: string;
  format: string;
  bytes: number;
}

export interface SaveInputOptions {
  kind: InputKind;
  /** Media locale; defaults to the project's source locale for screenshots and videos. */
  locale?: string;
  originalName: string;
  bytes: Uint8Array;
}

function folderFor(workspace: Workspace, kind: InputKind, locale?: LocaleId): string {
  const rule = INPUT_RULES[kind];
  return rule.perLocale && locale
    ? path.join(workspace.inputsDir, rule.folder, locale)
    : path.join(workspace.inputsDir, rule.folder);
}

function assertInside(parent: string, child: string): void {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new InputError('Invalid file location');
  }
}

/**
 * Checks and stores an uploaded input. Throws InputError for wrong type, size or locale.
 * Files are named `<timestamp>-<safe-name>.<ext>`, so uploads never overwrite each other.
 */
export async function saveInput(
  workspace: Workspace,
  sourceLocale: LocaleId,
  options: SaveInputOptions,
): Promise<StoredInput> {
  const rule = INPUT_RULES[options.kind];
  if (options.bytes.length === 0) throw new InputError('The file is empty');
  if (options.bytes.length > rule.maxBytes) {
    throw new InputError(`The file exceeds the limit of ${rule.maxBytes / MB} MB for a ${options.kind}`, 413);
  }

  let locale: LocaleId | undefined;
  if (rule.perLocale) {
    try {
      locale = getLocale(options.locale ?? sourceLocale).id;
    } catch (error) {
      throw new InputError((error as Error).message);
    }
  }

  const format = await detectFormat(options.bytes);
  if (!format || !rule.formats.includes(format)) {
    throw new InputError(
      `A ${options.kind} must be ${rule.formats.map((f) => f.toUpperCase()).join(', ')}; the file content is ${format ?? 'not a supported format'}`,
      415,
    );
  }

  const folder = folderFor(workspace, options.kind, locale);
  await mkdir(folder, { recursive: true });
  // Timestamp plus random suffix: parallel uploads of the same name never collide.
  const fileName = `${Date.now()}-${randomBytes(3).toString('hex')}-${safeBaseName(options.originalName)}.${EXTENSIONS[format] ?? format}`;
  const target = path.join(folder, fileName);
  assertInside(workspace.inputsDir, target);
  await writeFile(target, options.bytes, { flag: 'wx' });

  return {
    kind: options.kind,
    ...(locale ? { locale } : {}),
    path: path.relative(workspace.root, target).replace(/\\/g, '/'),
    format,
    bytes: options.bytes.length,
  };
}

/** Lists all stored inputs, grouped by kind and, for screenshots and videos, by locale folder. */
export async function listInputs(workspace: Workspace): Promise<StoredInput[]> {
  const result: StoredInput[] = [];
  for (const kind of ['logo', 'screenshot', 'video'] as const) {
    const rule = INPUT_RULES[kind];
    const base = path.join(workspace.inputsDir, rule.folder);
    const groups: { dir: string; locale?: LocaleId }[] = [];
    if (rule.perLocale) {
      for (const entry of await safeReaddir(base)) {
        try {
          groups.push({ dir: path.join(base, entry), locale: getLocale(entry).id });
        } catch {
          // Ignore folders that are not media locales.
        }
      }
    } else {
      groups.push({ dir: base });
    }
    for (const group of groups) {
      for (const name of (await safeReaddir(group.dir)).sort()) {
        // Skip hidden files and OS junk (Thumbs.db, desktop.ini) and anything that is not an input format.
        if (name.startsWith('.')) continue;
        const extension = path.extname(name).slice(1).toLowerCase();
        const format = extension === 'jpg' ? 'jpeg' : extension;
        if (!rule.formats.includes(format)) continue;
        const full = path.join(group.dir, name);
        let info;
        try {
          info = await stat(full);
        } catch {
          continue; // Deleted between readdir and stat.
        }
        if (!info.isFile()) continue;
        result.push({
          kind,
          ...(group.locale ? { locale: group.locale } : {}),
          path: path.relative(workspace.root, full).replace(/\\/g, '/'),
          format,
          bytes: info.size,
        });
      }
    }
  }
  return result;
}

async function safeReaddir(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
