import { Hono } from 'hono';
import { generateStorePreviews, renderPreviewFrame, type StorePreviewOptions } from '../core/generators/store-previews.js';
import { generateEmbedVideos, generateLoopVideos, type EmbedVideoOptions, type LoopVideoOptions } from '../core/generators/video-assets.js';
import { checkVideoTools } from '../core/video/index.js';
import type { Workspace } from '../core/workspace/index.js';
import { generatorError, pick } from './generate-routes.js';
import { readOptionalJsonObject } from './json-body.js';

/** Video routes, mounted under /api: tool check, App Store previews, device and loop videos, and preview frames. */
export function videoRoutes(workspace: Workspace): Hono {
  const api = new Hono();

  // Whether ffmpeg and ffprobe can be started, so the UI can explain what to install before anything runs.
  api.get('/video/tools', async (c) => c.json(await checkVideoTools()));

  api.post('/generate/store-previews', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['locales', 'trim', 'intro', 'outro', 'cardSeconds', 'background']) as StorePreviewOptions;
    try {
      return c.json(await generateStorePreviews(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  // Device videos for web and social (9:16, 16:9, 1:1).
  api.post('/generate/embed-videos', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['locales', 'formats', 'frame', 'texts', 'background', 'trim']) as EmbedVideoOptions;
    try {
      return c.json(await generateEmbedVideos(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  // The App Store's looping product page header and search videos.
  api.post('/generate/loop-videos', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['locales', 'trim']) as LoopVideoOptions;
    try {
      return c.json(await generateLoopVideos(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  // One frame of a generated preview, e.g. to choose the poster frame; only manifest entries of preview videos.
  api.get('/video/frame', async (c) => {
    const file = c.req.query('path') ?? '';
    const seconds = Number(c.req.query('seconds') ?? '5');
    try {
      const png = await renderPreviewFrame(workspace, file, seconds);
      return c.body(new Uint8Array(png), 200, {
        'content-type': 'image/png',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'",
        'cache-control': 'no-store',
      });
    } catch (error) {
      return generatorError(c, error);
    }
  });

  return api;
}
