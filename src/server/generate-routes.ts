import { Hono, type Context } from 'hono';
import { generateAndroidIcons, type AndroidIconOptions } from '../core/generators/android-icons.js';
import { generateAppStoreIcons, type AppStoreIconOptions } from '../core/generators/app-store-icons.js';
import { generateFramedScreenshots, type FramedScreenshotOptions } from '../core/generators/framed-screenshots.js';
import { generateScreenshotCards, renderCardPreview, type ScreenshotCardOptions } from '../core/generators/screenshot-cards.js';
import { generateShareImages, type ShareImageOptions } from '../core/generators/share-images.js';
import { GeneratorError, loadNewestLogo } from '../core/generators/logo.js';
import { generateLogoPack, listLogoOutputs } from '../core/generators/logo-packs.js';
import { logoPalette, renderLogoSquare } from '../core/generators/render.js';
import { BACKGROUND_PRESETS, backgroundsFromPalette, type BackgroundPreset } from '../core/screenshots/index.js';
import { generateWebIcons, type WebIconOptions } from '../core/generators/web-icons.js';
import { generateCreativeAssets, renderCreativePreview, type CreativeAssetOptions } from '../core/generators/creative-assets.js';
import {
  ProjectFileError,
  readCreativeSettings,
  readLogoSettings,
  saveCreativeSettings,
  saveLogoSettings,
  type Workspace,
} from '../core/workspace/index.js';
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

/** Parses `{ background?, logoScale? }` for the icon generators; returns an error message for a bad logoScale. */
function iconOptions(body: Record<string, unknown>): { options: Record<string, unknown> } | { error: string } {
  const scale = body.logoScale;
  if (scale !== undefined && (typeof scale !== 'number' || !Number.isFinite(scale))) return { error: 'logoScale must be a number' };
  return { options: pick(body, ['background', 'logoScale']) };
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
    const checked = iconOptions(parsed.body);
    if ('error' in checked) return c.json({ error: checked.error }, 400);
    try {
      return c.json(await generateAppStoreIcons(workspace, checked.options as AppStoreIconOptions), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/android-icons', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const checked = iconOptions(parsed.body);
    if ('error' in checked) return c.json({ error: checked.error }, 400);
    try {
      return c.json(await generateAndroidIcons(workspace, checked.options as AndroidIconOptions), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/framed-screenshots', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['frame', 'shadow', 'locales']) as FramedScreenshotOptions;
    try {
      return c.json(await generateFramedScreenshots(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/screenshot-cards', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['locales']) as ScreenshotCardOptions;
    try {
      return c.json(await generateScreenshotCards(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/share-images', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['background', 'taglines', 'locales']) as ShareImageOptions;
    try {
      return c.json(await generateShareImages(workspace, options), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/screenshots/preview', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { locale, device, index, width } = parsed.body;
    if (typeof locale !== 'string' || typeof device !== 'string' || typeof index !== 'number' || (width !== undefined && typeof width !== 'number')) {
      return c.json({ error: 'Send locale and device as text and index (and width) as numbers' }, 400);
    }
    try {
      const preview = await renderCardPreview(workspace, { locale, device, index, ...(width !== undefined ? { width } : {}) });
      return c.json({
        image: `data:image/png;base64,${preview.png.toString('base64')}`,
        width: preview.width,
        height: preview.height,
        warnings: preview.warnings,
        fallbackInput: preview.fallbackInput,
      });
    } catch (error) {
      return generatorError(c, error);
    }
  });

  // Background choices for screenshot cards: the neutral presets plus the logo's colours (when a logo exists).
  // The UI never defines colours itself; they are data from here.
  api.get('/screenshots/backgrounds', async (c) => {
    let palette: BackgroundPreset[] = [];
    try {
      palette = backgroundsFromPalette(await logoPalette(await loadNewestLogo(workspace)));
    } catch {
      // No logo, or a logo that cannot be read: the presets alone are still a full choice.
      palette = [];
    }
    return c.json({ presets: BACKGROUND_PRESETS, palette });
  });

  // The newest logo as a small PNG for the UI. SVG logos are rasterized here and never sent to the browser as markup.
  api.get('/inputs/logo-preview', async (c) => {
    try {
      const png = await renderLogoSquare(await loadNewestLogo(workspace), { size: 256, logoBox: 256 });
      return c.body(new Uint8Array(png), 200, {
        'content-type': 'image/png',
        'x-content-type-options': 'nosniff',
        'content-security-policy': "sandbox; default-src 'none'",
        'cache-control': 'no-store',
      });
    } catch (error) {
      if (error instanceof GeneratorError) return c.json({ error: error.message }, 404);
      throw error;
    }
  });

  api.get('/logo/settings', async (c) => c.json(await readLogoSettings(workspace)));

  // One logo pack with the saved settings; `locales` limits the share images.
  api.post('/generate/logo/:pack', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { locales } = parsed.body;
    if (locales !== undefined && typeof locales !== 'string' && !(Array.isArray(locales) && locales.every((l) => typeof l === 'string'))) {
      return c.json({ error: 'locales must be "all", a locale id or a list of locale ids' }, 400);
    }
    try {
      return c.json(await generateLogoPack(workspace, c.req.param('pack'), locales !== undefined ? { locales: locales as string | string[] } : {}), 201);
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.get('/logo/output', async (c) => c.json(await listLogoOutputs(workspace)));

  api.put('/logo/settings', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ errors: ['The request body must be JSON'] }, 400);
    }
    const result = await saveLogoSettings(workspace, body);
    return result.ok ? c.json(result.settings) : c.json({ errors: result.errors }, 400);
  });

  // App Store header, search and universal images: settings, a small preview with its safe area, and generation.
  api.get('/creative/settings', async (c) => c.json(await readCreativeSettings(workspace)));

  api.put('/creative/settings', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ errors: ['The request body must be JSON'] }, 400);
    }
    const result = await saveCreativeSettings(workspace, body);
    return result.ok ? c.json(result.settings) : c.json({ errors: result.errors }, 400);
  });

  api.post('/creative/preview', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { locale, specId, width } = parsed.body;
    if (typeof locale !== 'string' || typeof specId !== 'string' || (width !== undefined && typeof width !== 'number')) {
      return c.json({ error: 'Send locale and specId as text (and width as a number)' }, 400);
    }
    try {
      const preview = await renderCreativePreview(workspace, { locale, specId, ...(width !== undefined ? { width } : {}) });
      return c.json({
        image: `data:image/png;base64,${preview.png.toString('base64')}`,
        width: preview.width,
        height: preview.height,
        full: { width: preview.full.width, height: preview.full.height, safeWidth: preview.full.safeArea.width, safeHeight: preview.full.safeArea.height },
        safeArea: preview.safeArea,
        warnings: preview.warnings,
        fallbackInput: preview.fallbackInput,
      });
    } catch (error) {
      return generatorError(c, error);
    }
  });

  api.post('/generate/creative-assets', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const options = pick(parsed.body, ['locales', 'group']) as CreativeAssetOptions;
    try {
      return c.json(await generateCreativeAssets(workspace, options), 201);
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
