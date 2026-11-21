import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Hono, type Context } from 'hono';
import sharp from 'sharp';
import { ExportError, createExport, exportChecklist, locateOutputFile, readManifest, type ExportResult } from '../core/export/index.js';
import { ProjectFileError, type Workspace } from '../core/workspace/index.js';
import { readOptionalJsonObject } from './json-body.js';
import { preparedDownloads, type PreparedDownloads } from './prepared-downloads.js';
import { previewCache } from './preview-cache.js';
import { safeMediaHeaders } from './safe-media.js';

const PREVIEW_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4' };

/**
 * One byte range of a `Range: bytes=…` header (the only form browsers send for media): `start-end`, `start-` or
 * `-suffix`. Undefined when the whole file is sent: no header, several ranges, or an invalid range such as `5-3`
 * (RFC 9110 says to ignore it). 'invalid' (416) only for a range that cannot be satisfied: it starts after the file or
 * asks for a suffix of 0 bytes.
 */
export function byteRange(header: string | undefined, size: number): { start: number; end: number } | 'invalid' | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? '');
  if (!match) return undefined;
  const [, first = '', last = ''] = match;
  if (first === '' && last === '') return undefined;
  if (first === '') {
    const suffix = Number(last);
    if (suffix === 0 || size === 0) return 'invalid';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(first);
  if (last !== '' && Number(last) < start) return undefined;
  if (start >= size) return 'invalid';
  return { start, end: last === '' ? size - 1 : Math.min(Number(last), size - 1) };
}

/** Parses `?locales=all` or `?locales=de-DE,tr-TR`; absent means all locales of the project. */
function parseLocalesQuery(value: string | undefined): string[] | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  return value.split(',').map((locale) => locale.trim()).filter(Boolean);
}

function errorResponse(error: unknown): { body: Record<string, unknown>; status: 400 | 500 } {
  if (error instanceof ExportError) return { body: { error: error.message }, status: 400 };
  if (error instanceof ProjectFileError) {
    return { body: { error: 'project.json in the workspace is invalid', problems: error.problems }, status: 500 };
  }
  throw error;
}

/** Routes for the export checklist and the ZIP download, mounted under /api. */
export function exportRoutes(
  workspace: Workspace,
  downloads: PreparedDownloads = preparedDownloads({ pendingRoot: path.join(workspace.exportsDir, 'prepared'), doneDir: workspace.exportsDir }),
): Hono {
  const api = new Hono();
  const previews = previewCache();
  // Tokens do not survive a restart: waiting folders of earlier runs are removed once they are older than the TTL (#116).
  void downloads.cleanUp();

  api.get('/export/checklist', async (c) => {
    try {
      const locales = parseLocalesQuery(c.req.query('locales'));
      return c.json(await exportChecklist(workspace, locales ? { locales } : {}));
    } catch (error) {
      const { body, status } = errorResponse(error);
      return c.json(body, status);
    }
  });

  // The generated files (manifest entries) for previews.
  api.get('/output', async (c) => c.json((await readManifest(workspace)).entries));

  // Serves one generated raster image or MP4 video for a preview: only a path the manifest lists, that lies inside the
  // output folder (no links), and that is PNG, JPEG, WebP or MP4. Headers keep the browser from running or sniffing it.
  api.get('/output/file', async (c) => {
    const requested = c.req.query('path') ?? '';
    const entry = (await readManifest(workspace)).entries.find((e) => e.path === requested);
    const type = entry ? PREVIEW_TYPES[path.extname(entry.path).slice(1).toLowerCase()] : undefined;
    if (!entry || !type) return c.json({ error: 'Not a generated image' }, 404);
    const file = path.join(workspace.outputDir, entry.path);
    if ((await locateOutputFile(file, workspace.outputDir)) !== 'own') return c.json({ error: 'Not a generated image' }, 404);
    if (type === 'video/mp4') {
      // Streamed (previews can be tens of megabytes), with byte ranges so a <video> can seek and Safari plays it.
      const size = (await stat(file)).size;
      const headers = { ...safeMediaHeaders(type), 'accept-ranges': 'bytes' };
      const range = byteRange(c.req.header('range'), size);
      if (range === 'invalid') return c.body(null, 416, { 'content-range': `bytes */${size}` });
      if (!range) return c.body(Readable.toWeb(createReadStream(file)) as ReadableStream, 200, { ...headers, 'content-length': String(size) });
      return c.body(Readable.toWeb(createReadStream(file, range)) as ReadableStream, 206, {
        ...headers,
        'content-range': `bytes ${range.start}-${range.end}/${size}`,
        'content-length': String(range.end - range.start + 1),
      });
    }
    // ?width= gives a smaller copy for preview grids (never larger than the file).
    const width = Number(c.req.query('width'));
    const scaled = Number.isInteger(width) && width >= 16 && width <= 1024;
    // Resized copies are cached by file size and change time, so a preview grid is not resized again on every request.
    const bytes = scaled
      ? await previews.get(file, `w${width}`, () => sharp(file).resize({ width, withoutEnlargement: true }).png().toBuffer())
      : await readFile(file);
    return c.body(new Uint8Array(bytes), 200, safeMediaHeaders(scaled ? 'image/png' : type));
  });

  /** Builds the ZIP for the request body's locales; stops when the requester is gone (#47). */
  async function buildExport(c: Context, folder?: string): Promise<{ result: ExportResult } | { response: Response }> {
    // An empty body means "all locales"; anything else must be JSON with a string or string list.
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return { response: c.json({ error: parsed.error }, 400) };
    const body = parsed.body as { locales?: unknown };
    let locales: string | string[] | undefined;
    if (typeof body.locales === 'string') locales = body.locales;
    else if (Array.isArray(body.locales) && body.locales.every((l) => typeof l === 'string')) locales = body.locales;
    else if (body.locales !== undefined) {
      return { response: c.json({ error: 'locales must be "all", a locale id or a list of locale ids' }, 400) };
    }
    try {
      return { result: await createExport(workspace, { ...(locales !== undefined ? { locales } : {}), signal: c.req.raw.signal, ...(folder ? { folder } : {}) }) };
    } catch (error) {
      // The requester is gone (only the abort itself, not another failure at the same time): the partial ZIP is removed.
      if (c.req.raw.signal.aborted && error === c.req.raw.signal.reason) return { response: c.json({ error: 'The export was cancelled' }, 400) };
      const { body: errorBody, status } = errorResponse(error);
      return { response: c.json(errorBody, status) };
    }
  }

  // Builds the ZIP and answers with it (API and skill clients).
  api.post('/export', async (c) => {
    const built = await buildExport(c);
    if ('response' in built) return built.response;
    const { result } = built;
    return c.body(Readable.toWeb(createReadStream(result.file)) as ReadableStream, 200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${result.fileName}"`,
      'x-export-status': result.checklist.status,
    });
  });

  // The UI's download in two steps (#47): this builds the ZIP and answers with its status and a one-time token; the
  // browser then opens /export/download?token=… as a plain download, so the ZIP streams straight to disk instead of
  // being held in memory.
  api.post('/export/prepare', async (c) => {
    const built = await buildExport(c, await downloads.folder());
    if ('response' in built) return built.response;
    const { result } = built;
    return c.json({ token: downloads.issue(result.file, result.fileName), fileName: result.fileName, status: result.checklist.status });
  });

  api.get('/export/download', async (c) => {
    const expired = { error: 'This download link has expired. Start the download again.' };
    // Only a vanished file means "expired"; other file errors (e.g. a locked file) reach the error handler and the log.
    const download = await downloads.take(c.req.query('token') ?? '').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (!download) return c.json(expired, 404);
    const size = await stat(download.file).then((info) => info.size, () => null);
    if (size === null) return c.json(expired, 404);
    return c.body(Readable.toWeb(createReadStream(download.file)) as ReadableStream, 200, {
      'content-type': 'application/zip',
      'content-length': String(size),
      'content-disposition': `attachment; filename="${download.fileName}"`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
  });

  return api;
}
