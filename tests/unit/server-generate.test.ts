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
