// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { saveInput } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { svgBytes, workspaceFactory } from '../factories/workspace.js';

const URL = 'http://localhost:4790/api/generate/web-icons';

async function appFactory(withLogo: boolean) {
  const workspace = await workspaceFactory();
  if (withLogo) await saveInput(workspace, 'en-US', { kind: 'logo', originalName: 'logo.svg', bytes: svgBytes() });
  return createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
}

const post = (app: Awaited<ReturnType<typeof appFactory>>, body?: string) =>
  app.request(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, ...(body ? { body } : {}) });

describe('The generate API builds the web icons', () => {
  test('generates the web icons and returns the registered files', async () => {
    const response = await post(await appFactory(true), JSON.stringify({ background: '#0079dd' }));
    expect(response.status).toBe(201);
    const entries = (await response.json()) as { path: string }[];
    expect(entries).toHaveLength(8);
    expect(entries[0]?.path).toBe('web/shared/favicons/favicon.ico');
  });

  test('asks for a logo with 400 when none was uploaded', async () => {
    const response = await post(await appFactory(false));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Upload a logo first' });
  });

  test('rejects a colour that is not a hex value', async () => {
    const response = await post(await appFactory(true), JSON.stringify({ themeColor: 'red;}' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'themeColor must be a colour like #1a2b3c' });
  });

  test('rejects a body that is not a JSON object', async () => {
    const app = await appFactory(true);
    expect((await post(app, 'null')).status).toBe(400);
    expect((await post(app, '[1]')).status).toBe(400);
    expect(await (await post(app, '5')).json()).toEqual({ error: 'The request body must be a JSON object' });
  });

  test('rejects a request from another website', async () => {
    const app = await appFactory(true);
    const response = await app.request(URL, { method: 'POST', headers: { origin: 'https://evil.example' } });
    expect(response.status).toBe(403);
  });
});

describe('The generate API builds the App Store icons and offers the logo palette', () => {
  const base = 'http://localhost:4790/api';

  test('generates the App Store icons with a background and logo scale', async () => {
    const app = await appFactory(true);
    const response = await app.request(`${base}/generate/app-store-icons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ background: '#0079dd', logoScale: 0.6 }),
    });
    expect(response.status).toBe(201);
    expect(((await response.json()) as unknown[]).length).toBe(5);
  });

  test('rejects a logo scale that is not a number and a missing logo', async () => {
    const withLogo = await appFactory(true);
    const bad = await withLogo.request(`${base}/generate/app-store-icons`, { method: 'POST', body: JSON.stringify({ logoScale: 'big' }) });
    expect(bad.status).toBe(400);
    const noLogo = await (await appFactory(false)).request(`${base}/generate/app-store-icons`, { method: 'POST' });
    expect(await noLogo.json()).toEqual({ error: 'Upload a logo first' });
  });

  test('returns the palette of the uploaded logo', async () => {
    const response = await (await appFactory(true)).request(`${base}/logo/palette`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { colors: string[] };
    expect(body.colors[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('The generate API builds the Android icons', () => {
  test('generates the Play icon and the launcher resources', async () => {
    const app = await appFactory(true);
    const response = await app.request('http://localhost:4790/api/generate/android-icons', { method: 'POST', body: JSON.stringify({ background: '#222222' }) });
    expect(response.status).toBe(201);
    expect(((await response.json()) as unknown[]).length).toBe(22);
  });

  test('asks for a logo with 400 when none was uploaded', async () => {
    const response = await (await appFactory(false)).request('http://localhost:4790/api/generate/android-icons', { method: 'POST' });
    expect(response.status).toBe(400);
  });
});
