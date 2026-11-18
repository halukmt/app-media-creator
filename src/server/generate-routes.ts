import { Hono, type Context } from 'hono';
import { generateAppStoreIcons, type AppStoreIconOptions } from '../core/generators/app-store-icons.js';
import { GeneratorError, loadNewestLogo } from '../core/generators/logo.js';
import { logoPalette } from '../core/generators/render.js';
import { generateWebIcons, type WebIconOptions } from '../core/generators/web-icons.js';
import { ProjectFileError, type Workspace } from '../core/workspace/index.js';
import { readOptionalJsonObject } from './json-body.js';

/** Maps known generator errors to JSON responses; rethrows everything else. */
function generatorError(c: Context, error: unknown) {
  if (error instanceof GeneratorError) return c.json({ error: error.message }, 400);
  if (error instanceof ProjectFileError) {
    return c.json({ error: 'project.json in the workspace is invalid', problems: error.problems }, 500);
  }
  throw error;
}

/** Copies the given fields from the body; the generators validate their values. */
function pick(body: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
}

/** Routes that run generators, mounted under /api. */
export function generateRoutes(workspace: Workspace): Hono {
  const api = new Hono();

  api.post('/generate/web-icons', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['background', 'darkBackground', 'themeColor']) as WebIconOptions;
    try {
      return c.json(await generateWebIcons(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/app-store-icons', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const scale = parsed.body.logoScale;
    if (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale))) {
      return c.json({ error: 'logoScale must be a number' }, 400);
    }
    const options = pick(parsed.body, ['background', 'logoScale']) as AppStoreIconOptions;
    try {
      return c.json(await generateAppStoreIcons(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.get('/logo/palette', async (c) => {
    try {
      return c.json({ colors: await logoPalette(await loadNewestLogo(workspace)) });
    } catch (error) {
      return generatorError(c, error);
    }
  });

  return api;
}
