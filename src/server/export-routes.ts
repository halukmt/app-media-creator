import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Hono } from 'hono';
import sharp from 'sharp';
import { ExportError, createExport, exportChecklist, locateOutputFile, readManifest } from '../core/export/index.js';
import { ProjectFileError, type Workspace } from '../core/workspace/index.js';
import { readOptionalJsonObject } from './json-body.js';

const PREVIEW_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

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
export function exportRoutes(workspace: Workspace): Hono {
  const api = new Hono();

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

  // Serves one generated raster image for a preview: only a path the manifest lists, that lies inside the output
  // folder (no links), and that is PNG, JPEG or WebP. Headers keep the browser from running or sniffing it.
  api.get('/output/file', async (c) => {
    const requested = c.req.query('path') ?? '';
    const entry = (await readManifest(workspace)).entries.find((e) => e.path === requested);
    const type = entry ? PREVIEW_TYPES[path.extname(entry.path).slice(1).toLowerCase()] : undefined;
    if (!entry || !type) return c.json({ error: 'Not a generated image' }, 404);
    const file = path.join(workspace.outputDir, entry.path);
    if ((await locateOutputFile(file, workspace.outputDir)) !== 'own') return c.json({ error: 'Not a generated image' }, 404);
    // ?width= gives a smaller copy for preview grids (never larger than the file).
    const width = Number(c.req.query('width'));
    const scaled = Number.isInteger(width) && width >= 16 && width <= 1024;
    const bytes = scaled ? await sharp(file).resize({ width, withoutEnlargement: true }).png().toBuffer() : await readFile(file);
    return c.body(new Uint8Array(bytes), 200, {
      'content-type': scaled ? 'image/png' : type,
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
      'cache-control': 'no-store',
    });
  });

  api.post('/export', async (c) => {
    let locales: string | string[] | undefined;
    try {
      // An empty body means "all locales"; anything else must be JSON with a string or string list.
      const parsed = await readOptionalJsonObject(c);
      if (!parsed.ok) return c.json({ error: parsed.error }, 400);
      const body = parsed.body as { locales?: unknown };
      if (typeof body.locales === 'string') locales = body.locales;
      else if (Array.isArray(body.locales) && body.locales.every((l) => typeof l === 'string')) locales = body.locales;
      else if (body.locales !== undefined) {
        return c.json({ error: 'locales must be "all", a locale id or a list of locale ids' }, 400);
      }
      const result = await createExport(workspace, locales !== undefined ? { locales } : {});
      const stream = Readable.toWeb(createReadStream(result.file)) as ReadableStream;
      return c.body(stream, 200, {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${result.fileName}"`,
        'x-export-status': result.checklist.status,
      });
    } catch (error) {
      const { body, status } = errorResponse(error);
      return c.json(body, status);
    }
  });

  return api;
}
