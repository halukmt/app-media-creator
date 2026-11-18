import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { PackageInfo } from '../core/package-info.js';

export interface AppOptions {
  /** Directory with the built web UI (dist/web). Static serving is skipped when it does not exist. */
  webRoot: string;
  packageInfo: PackageInfo;
}

/** Creates the HTTP app: JSON API under /api, the built web UI for everything else. */
export function createApp({ webRoot, packageInfo }: AppOptions): Hono {
  const app = new Hono();

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', name: packageInfo.name, version: packageInfo.version }),
  );

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  if (existsSync(webRoot)) {
    // An absolute root keeps working when the CLI runs from another directory or drive.
    const root = path.resolve(webRoot);
    app.use('/*', serveStatic({ root }));
    // Single-page app: unknown routes fall back to index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}
