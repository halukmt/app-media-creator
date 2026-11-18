import { existsSync } from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { PackageInfo } from '../core/package-info.js';
import type { Workspace } from '../core/workspace/index.js';
import { localOnly } from './protection.js';
import { catalogueRoutes } from './catalogue-routes.js';
import { exportRoutes } from './export-routes.js';
import { generateRoutes } from './generate-routes.js';
import { workspaceRoutes } from './workspace-routes.js';

export interface AppOptions {
  /** Directory with the built web UI (dist/web). Static serving is skipped when it does not exist. */
  webRoot: string;
  packageInfo: PackageInfo;
  /** Workspace for project settings and inputs. Without it only /api/health is available. */
  workspace?: Workspace;
}

/** Creates the HTTP app: JSON API under /api, the built web UI for everything else. */
export function createApp({ webRoot, packageInfo, workspace }: AppOptions): Hono {
  const app = new Hono();

  app.use('/api/*', localOnly());

  app.get('/api/health', (c) =>
    c.json({ status: 'ok', name: packageInfo.name, version: packageInfo.version }),
  );

  app.route('/api', catalogueRoutes());

  if (workspace) {
    app.route('/api', workspaceRoutes(workspace));
    app.route('/api', exportRoutes(workspace));
    app.route('/api', generateRoutes(workspace));
  }

  app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

  app.onError((error, c) => {
    console.error(error);
    return c.json({ error: 'Internal error' }, 500);
  });

  if (existsSync(webRoot)) {
    // An absolute root keeps working when the CLI runs from another directory or drive.
    const root = path.resolve(webRoot);
    app.use('/*', serveStatic({ root }));
    // Single-page app: unknown routes fall back to index.html.
    app.get('*', serveStatic({ root, path: 'index.html' }));
  }

  return app;
}
