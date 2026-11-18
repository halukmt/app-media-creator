// conventions: RULE-TESTING-3301
import { writeFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { pngBytes, projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const BASE = 'http://localhost:4790';

async function appFactory() {
  const workspace = await workspaceFactory();
  return { workspace, app: createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace }) };
}

async function uploadForm(locale?: string): Promise<FormData> {
  const form = new FormData();
  form.set('file', new File([await pngBytes()], 'shot.png', { type: 'image/png' }));
  if (locale) form.set('locale', locale);
  return form;
}

describe('The project API reads and saves settings', () => {
  test('returns the default settings of a new workspace', async () => {
    const { app } = await appFactory();
    const response = await app.request(`${BASE}/api/project`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'demo-repo', sourceLocale: 'en-US' });
  });

  test('saves valid settings and returns them', async () => {
    const { app } = await appFactory();
    const response = await app.request(`${BASE}/api/project`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:4790' },
      body: JSON.stringify(projectInputFactory({ name: 'Demo', locales: 'all' })),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: 'Demo' });
  });

  test('rejects invalid settings with 400 and the field errors', async () => {
    const { app } = await appFactory();
    const response = await app.request(`${BASE}/api/project`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(projectInputFactory({ locales: ['pt-BR'] })),
    });
    expect(response.status).toBe(400);
    expect((await response.json()) as { errors: string[] }).toMatchObject({ errors: [expect.stringContaining('pt-BR')] });
  });

  test('rejects a body that is not JSON', async () => {
    const { app } = await appFactory();
    const response = await app.request(`${BASE}/api/project`, { method: 'PUT', body: 'nope' });
    expect(response.status).toBe(400);
  });
});

describe('The inputs API stores and lists uploads', () => {
  test('stores a screenshot for tr-TR and lists it', async () => {
    const { app } = await appFactory();
    const upload = await app.request(`${BASE}/api/inputs/screenshot`, { method: 'POST', body: await uploadForm('tr-TR') });
    expect(upload.status).toBe(201);
    const list = (await (await app.request(`${BASE}/api/inputs`)).json()) as { locale: string }[];
    expect(list.map((i) => i.locale)).toEqual(['tr-TR']);
  });

  test('rejects an unknown input kind and a missing file', async () => {
    const { app } = await appFactory();
    expect((await app.request(`${BASE}/api/inputs/music`, { method: 'POST', body: await uploadForm() })).status).toBe(404);
    expect((await app.request(`${BASE}/api/inputs/logo`, { method: 'POST', body: new FormData() })).status).toBe(400);
  });

  test('rejects a logo body above the logo limit with 413 before reading it', async () => {
    const { app } = await appFactory();
    const form = new FormData();
    form.set('file', new File([new Uint8Array(12 * 1024 * 1024)], 'huge.png'));
    const response = await app.request(`${BASE}/api/inputs/logo`, { method: 'POST', body: form });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: 'The file exceeds the limit of 10 MB for a logo' });
  });

  test('explains a damaged project.json instead of failing silently', async () => {
    const { app, workspace } = await appFactory();
    writeFileSync(workspace.projectFile, JSON.stringify({ name: 'x' }));
    const response = await app.request(`${BASE}/api/project`);
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string; problems: string[] };
    expect(body.error).toBe('project.json in the workspace is invalid');
    expect(body.problems.length).toBeGreaterThan(0);
    const upload = await app.request(`${BASE}/api/inputs/screenshot`, { method: 'POST', body: await uploadForm() });
    expect(upload.status).toBe(500);
  });

  test('rejects a file whose content is not an image with 415', async () => {
    const { app } = await appFactory();
    const form = new FormData();
    form.set('file', new File(['text'], 'shot.png'));
    const response = await app.request(`${BASE}/api/inputs/screenshot`, { method: 'POST', body: form });
    expect(response.status).toBe(415);
  });
});
