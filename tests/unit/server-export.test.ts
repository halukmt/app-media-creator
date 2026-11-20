// conventions: RULE-TESTING-3301
import { existsSync, readdirSync, utimesSync } from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { createExport, registerOutput } from '../../src/core/export/index.js';
import { createApp } from '../../src/server/app.js';
import { preparedDownloads } from '../../src/server/prepared-downloads.js';
import { preparedFoldersFactory } from '../factories/export.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { pngBytes, workspaceFactory } from '../factories/workspace.js';

const BASE = 'http://localhost:4790';

async function appFactory() {
  const workspace = await workspaceFactory();
  await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes() });
  return createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
}

describe('The export API returns the checklist and the ZIP', () => {
  test('returns the checklist for the requested locales', async () => {
    const app = await appFactory();
    const response = await app.request(`${BASE}/api/export/checklist?locales=de-DE,tr-TR`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { locales: string[]; targets: { target: string }[] };
    expect(body.locales).toEqual(['de-DE', 'tr-TR']);
    expect(body.targets.map((t) => t.target)).toEqual(['apple', 'google', 'web']);
  });

  test('rejects an unsupported locale with 400', async () => {
    const app = await appFactory();
    const response = await app.request(`${BASE}/api/export/checklist?locales=pt-BR`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'pt-BR is not a supported locale' });
  });

  test('downloads the ZIP as an attachment', async () => {
    const app = await appFactory();
    const response = await app.request(`${BASE}/api/export`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locales: ['de-DE'] }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="demo-repo-de-DE-.*\.zip"$/);
    expect(response.headers.get('x-export-status')).toBe('error');
    const names = Object.keys(unzipSync(new Uint8Array(await response.arrayBuffer())));
    expect(names).toContain('apple/shared/icon/app-icon.png');
  });

  test('rejects a body that is not JSON, a wrong locales type and an empty list with 400', async () => {
    const app = await appFactory();
    const post = (body: string) =>
      app.request(`${BASE}/api/export`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
    expect((await post('{nope')).status).toBe(400);
    expect((await post('{"locales": 5}')).status).toBe(400);
    expect((await post('{"locales": []}')).status).toBe(400);
  });

  test('exports all locales when the body is empty', async () => {
    const app = await appFactory();
    const response = await app.request(`${BASE}/api/export`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('-all-');
  });

  test('rejects an export request from another website', async () => {
    const app = await appFactory();
    const response = await app.request(`${BASE}/api/export`, { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(response.status).toBe(403);
  });
});

describe('The UI download is prepared, then streamed with a one-time token (#47)', () => {
  const prepare = (app: Awaited<ReturnType<typeof appFactory>>, locales: string[]) =>
    app.request(`${BASE}/api/export/prepare`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locales }) });

  test('answers with name, status and a token whose download is the ZIP as an attachment', async () => {
    const app = await appFactory();
    const prepared = await prepare(app, ['de-DE']);
    expect(prepared.status).toBe(200);
    const body = (await prepared.json()) as { token: string; fileName: string; status: string };
    expect(body.fileName).toMatch(/^demo-repo-de-DE-.*\.zip$/);
    expect(body.status).toBe('error');
    expect(body.token).toMatch(/^[0-9a-f]{48}$/);
    const download = await app.request(`${BASE}/api/export/download?token=${body.token}`);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toBe(`attachment; filename="${body.fileName}"`);
    expect(Object.keys(unzipSync(new Uint8Array(await download.arrayBuffer())))).toContain('CHECKLIST.md');
  });

  test('serves a token again for a retry, refuses unknown tokens and a wrong locale before anything is built', async () => {
    const app = await appFactory();
    const { token } = (await (await prepare(app, ['de-DE'])).json()) as { token: string };
    await app.request(`${BASE}/api/export/download?token=${token}`);
    // A download manager may retry the same link.
    expect((await app.request(`${BASE}/api/export/download?token=${token}`)).status).toBe(200);
    expect((await app.request(`${BASE}/api/export/download?token=nope`)).status).toBe(404);
    expect((await prepare(app, ['pt-BR'])).status).toBe(400);
  });

  test('moves a fetched ZIP once, also for parallel fetches, and removes one never fetched on its own timer (#116)', async () => {
    const { exportsDir, pendingRoot, zip } = preparedFoldersFactory();
    const timers: (() => Promise<void>)[] = [];
    const downloads = preparedDownloads({ pendingRoot, doneDir: exportsDir, setTimer: (run) => timers.push(run) });
    const folder = await downloads.folder();
    const never = downloads.issue(zip(folder, 'never.zip'), 'never.zip');
    const fetched = downloads.issue(zip(folder, 'fetched.zip'), 'fetched.zip');
    // Two fetches at the same time share the one move.
    const [first, second] = await Promise.all([downloads.take(fetched), downloads.take(fetched)]);
    expect(first).toEqual({ file: path.join(exportsDir, 'fetched.zip'), fileName: 'fetched.zip' });
    expect(second?.file).toBe(path.join(exportsDir, 'fetched.zip'));

    // No later request: the timers alone end both tokens.
    await Promise.all(timers.map((run) => run()));
    expect(await downloads.take(never)).toBeUndefined();
    expect(readdirSync(folder)).toEqual([]);
    expect(existsSync(path.join(exportsDir, 'fetched.zip'))).toBe(true);
  });

  test('removes old waiting folders of earlier runs at start, never those of runs still alive', async () => {
    const { exportsDir, pendingRoot, zip } = preparedFoldersFactory();
    zip(path.join(pendingRoot, 'old-run'), 'left.zip');
    zip(path.join(pendingRoot, 'live-run'), 'fresh.zip');
    zip(exportsDir, 'kept.zip');
    const old = Date.now() - 60 * 60_000;
    utimesSync(path.join(pendingRoot, 'old-run'), old / 1000, old / 1000);
    await preparedDownloads({ pendingRoot, doneDir: exportsDir }).cleanUp();
    expect(readdirSync(pendingRoot)).toEqual(['live-run']);
    expect(existsSync(path.join(exportsDir, 'kept.zip'))).toBe(true);
  });

  test('builds a prepared ZIP in the waiting folder and moves it to the exports on download', async () => {
    const workspace = await workspaceFactory();
    await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes() });
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const { token, fileName } = (await (await prepare(app, ['de-DE'])).json()) as { token: string; fileName: string };
    const [runFolder] = readdirSync(path.join(workspace.exportsDir, 'prepared'));
    expect(readdirSync(path.join(workspace.exportsDir, 'prepared', runFolder!))).toEqual([fileName]);
    expect((await app.request(`${BASE}/api/export/download?token=${token}`)).status).toBe(200);
    expect(existsSync(path.join(workspace.exportsDir, fileName))).toBe(true);
    expect((await app.request(`${BASE}/api/export/download?token=${token}`)).status).toBe(200);
  });

  test('stops building the ZIP when the requester is gone and leaves no partial file', async () => {
    const workspace = await workspaceFactory();
    await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes() });
    const controller = new AbortController();
    controller.abort();
    await expect(createExport(workspace, { signal: controller.signal })).rejects.toThrow();
    expect(existsSync(workspace.exportsDir) ? readdirSync(workspace.exportsDir) : []).toEqual([]);
  });
});
