// conventions: RULE-TESTING-3301
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { pngBytes, workspaceFactory } from '../factories/workspace.js';

async function setup() {
  const workspace = await workspaceFactory();
  const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
  const upload = async (headers: Record<string, string>, url = 'http://localhost:4790/api/inputs/logo') => {
    const form = new FormData();
    form.set('file', new File([await pngBytes()], 'logo.png'));
    return app.request(url, { method: 'POST', body: form, headers });
  };
  const logoDir = path.join(workspace.inputsDir, 'logo');
  const stored = () => (existsSync(logoDir) ? readdirSync(logoDir).length : 0);
  return { upload, stored, app };
}

describe('The local API rejects requests from other websites', () => {
  test('stores an upload sent by the tool UI itself', async () => {
    const { upload, stored } = await setup();
    const response = await upload({ origin: 'http://localhost:4790', 'sec-fetch-site': 'same-origin' });
    expect(response.status).toBe(201);
    expect(stored()).toBe(1);
  });

  test('accepts the Vite dev server origin when the request is proxied with its host', async () => {
    const { upload } = await setup();
    const response = await upload({ origin: 'http://localhost:5173', host: 'localhost:5173' });
    expect(response.status).toBe(201);
  });

  test('rejects an upload from another origin and stores nothing', async () => {
    const { upload, stored } = await setup();
    const response = await upload({ origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect(stored()).toBe(0);
  });

  test('rejects a cross-site request even without an origin header', async () => {
    const { upload } = await setup();
    expect((await upload({ 'sec-fetch-site': 'cross-site' })).status).toBe(403);
  });

  test('rejects any request with a foreign host name (DNS rebinding)', async () => {
    const { app, upload } = await setup();
    expect((await app.request('http://attacker.example:4790/api/project')).status).toBe(403);
    expect((await upload({}, 'http://attacker.example:4790/api/inputs/logo')).status).toBe(403);
  });

  test('accepts 127.0.0.1 as host', async () => {
    const { app } = await setup();
    expect((await app.request('http://127.0.0.1:4790/api/health')).status).toBe(200);
  });
});
