// conventions: RULE-TESTING-3301
import { unzipSync } from 'fflate';
import { describe, expect, test } from 'vitest';
import { registerOutput } from '../../src/core/export/index.js';
import { createApp } from '../../src/server/app.js';
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
