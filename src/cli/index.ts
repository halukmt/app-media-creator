#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { readPackageInfo } from '../core/package-info.js';
import { openWorkspace } from '../core/workspace/index.js';
import { createApp } from '../server/app.js';
import { HELP_TEXT, parseArgs } from './args.js';

const here = path.dirname(fileURLToPath(import.meta.url));
// Works for both dist/cli/index.js (built) and src/cli/index.ts (tsx in development).
const packageRoot = path.resolve(here, '..', '..');
const webRoot = path.join(packageRoot, 'dist', 'web');

function openBrowser(url: string): void {
  const command =
    process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(command, args, { stdio: 'ignore', detached: true }).unref();
}

async function main(): Promise<void> {
  let options;
  try {
    options = parseArgs(process.argv.slice(2), process.env);
  } catch (error) {
    console.error((error as Error).message);
    console.error(HELP_TEXT);
    process.exitCode = 1;
    return;
  }

  const packageInfo = readPackageInfo(path.join(packageRoot, 'package.json'));
  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }
  if (options.version) {
    console.log(packageInfo.version);
    return;
  }

  const workspace = await openWorkspace(path.resolve(process.cwd(), options.workspace));
  const app = createApp({ webRoot, packageInfo, workspace });
  // Listen on the loopback interface only: the tool must not be reachable from the network.
  serve({ fetch: app.fetch, port: options.port, hostname: '127.0.0.1' }, (info) => {
    const url = `http://127.0.0.1:${info.port}`;
    console.log(`${packageInfo.name} ${packageInfo.version} running at ${url}`);
    console.log(`Workspace: ${workspace.root}`);
    if (options.open) openBrowser(url);
  });
}

main().catch((error: unknown) => {
  console.error((error as Error).message);
  process.exitCode = 1;
});
