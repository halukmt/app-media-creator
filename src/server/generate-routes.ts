import { Hono } from 'hono';
import { isHexColor } from '../core/generators/render.js';
import { GeneratorError, generateWebIcons, type WebIconOptions } from '../core/generators/web-icons.js';
import { ProjectFileError, type Workspace } from '../core/workspace/index.js';
import { readOptionalJsonObject } from './json-body.js';

const COLOR_FIELDS = ['background', 'darkBackground', 'themeColor'] as const;

/** Routes that run generators, mounted under /api. */
export function generateRoutes(workspace: Workspace): Hono {
  const api = new Hono();

  api.post('/generate/web-icons', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const body = parsed.body;
    const options: WebIconOptions = {};
    for (const field of COLOR_FIELDS) {
      const value = body[field];
      if (value === undefined) continue;
      if (!isHexColor(value)) return c.json({ error: `${field} must be a colour like #1a2b3c` }, 400);
      options[field] = value;
    }
    try {
      return c.json(await generateWebIcons(workspace, options), 201);
    } catch (error) {
      if (error instanceof GeneratorError) return c.json({ error: error.message }, 400);
      if (error instanceof ProjectFileError) {
        return c.json({ error: 'project.json in the workspace is invalid', problems: error.problems }, 500);
      }
      throw error;
    }
  });

  return api;
}
