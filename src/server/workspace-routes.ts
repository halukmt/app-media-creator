import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  INPUT_RULES,
  InputError,
  ProjectFileError,
  isInputKind,
  listInputs,
  listScreenshots,
  readScreenshotSets,
  saveScreenshotSets,
  readProject,
  saveInput,
  saveProject,
  type Workspace,
} from '../core/workspace/index.js';
import { safeMediaHeaders } from './safe-media.js';

const MULTIPART_OVERHEAD = 1024 * 1024;

/** Maps known workspace errors to JSON responses the UI can show; rethrows everything else. */
function handleError(c: Context, error: unknown) {
  if (error instanceof InputError) return c.json({ error: error.message }, error.status);
  if (error instanceof ProjectFileError) {
    return c.json({ error: 'project.json in the workspace is invalid', problems: error.problems }, 500);
  }
  throw error;
}

/** Routes for project settings and inputs of one workspace, mounted under /api. */
export function workspaceRoutes(workspace: Workspace): Hono {
  const api = new Hono();

  api.get('/project', async (c) => {
    try {
      return c.json(await readProject(workspace));
    } catch (error) {
      return handleError(c, error);
    }
  });

  api.put('/project', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ errors: ['The request body must be JSON'] }, 400);
    }
    const result = await saveProject(workspace, body);
    return result.ok ? c.json(result.project) : c.json({ errors: result.errors }, 400);
  });

  api.get('/inputs', async (c) => c.json(await listInputs(workspace)));

  // Serves an uploaded screenshot for thumbnails. Only paths listed as raster screenshot uploads are served (no
  // SVG, no other files), with headers that keep the browser from running or sniffing the content.
  api.get('/inputs/file', async (c) => {
    const requested = c.req.query('path') ?? '';
    const input = (await listScreenshots(workspace)).find((s) => s.path === requested);
    if (!input) return c.json({ error: 'Not an uploaded screenshot' }, 404);
    const bytes = await readFile(path.join(workspace.root, input.path));
    return c.body(new Uint8Array(bytes), 200, safeMediaHeaders(`image/${input.format}`));
  });

  api.get('/screenshots', async (c) => c.json(await readScreenshotSets(workspace)));

  api.put('/screenshots', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ errors: ['The request body must be JSON'] }, 400);
    }
    // The UI names the revision its document is based on; without it an older tab could overwrite newer changes.
    if (typeof body !== 'object' || body === null || typeof (body as { revision?: unknown }).revision !== 'number') {
      return c.json({ errors: ['revision: the revision the changes are based on is required'] }, 400);
    }
    const result = await saveScreenshotSets(workspace, body);
    if (result.ok) return c.json(result.sets);
    // 409 with the current sets, so the page can show what changed instead of keeping a stale copy.
    if (result.conflict) return c.json({ errors: result.errors, current: await readScreenshotSets(workspace) }, 409);
    return c.json({ errors: result.errors }, 400);
  });

  api.post(
    '/inputs/:kind',
    async (c, next) => {
      const kind = c.req.param('kind');
      if (!isInputKind(kind)) return c.json({ error: `Unknown input kind: ${kind}` }, 404);
      // Limit the body to this kind's maximum before anything is buffered.
      const limit = bodyLimit({
        maxSize: INPUT_RULES[kind].maxBytes + MULTIPART_OVERHEAD,
        onError: (ctx) => ctx.json({ error: `The file exceeds the limit of ${INPUT_RULES[kind].maxBytes / (1024 * 1024)} MB for a ${kind}` }, 413),
      });
      return limit(c, next);
    },
    async (c) => {
      const kind = c.req.param('kind');
      if (!isInputKind(kind)) return c.json({ error: `Unknown input kind: ${kind}` }, 404);

      const form = await c.req.parseBody();
      const file = form.file;
      if (!(file instanceof File)) return c.json({ error: 'Send the file in the form field "file"' }, 400);
      const locale = typeof form.locale === 'string' && form.locale !== '' ? form.locale : undefined;

      try {
        const project = await readProject(workspace);
        const stored = await saveInput(workspace, project.sourceLocale, {
          kind,
          ...(locale ? { locale } : {}),
          originalName: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        return c.json(stored, 201);
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  return api;
}
