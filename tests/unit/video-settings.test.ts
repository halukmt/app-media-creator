// conventions: RULE-TESTING-3301
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { registerOutput } from '../../src/core/export/index.js';
import { defaultVideoSettings, readVideoSettings, saveVideoSettings, validateVideoSettings } from '../../src/core/workspace/index.js';
import { byteRange } from '../../src/server/export-routes.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { workspaceFactory } from '../factories/workspace.js';

describe('The video settings are validated and stored', () => {
  test('stores purpose, trim, card texts per language and the device video options', async () => {
    const workspace = await workspaceFactory();
    const input = { ...defaultVideoSettings(), purpose: 'device-video', trim: { start: 1.5 }, intro: { 'tr-TR': ' Adil takımlar ', 'de-DE': '' }, formats: ['square', 'vertical'], frame: 'none' };
    const saved = await saveVideoSettings(workspace, input);
    expect(saved).toMatchObject({ ok: true, settings: { purpose: 'device-video', trim: { start: 1.5 }, intro: { 'tr-TR': 'Adil takımlar' }, formats: ['vertical', 'square'], frame: 'none' } });
    expect((await readVideoSettings(workspace)).intro).toEqual({ 'tr-TR': 'Adil takımlar' });
  });

  test('rejects an unknown purpose, an end before the start, no format and a foreign locale; a broken file reads as defaults', async () => {
    const base = defaultVideoSettings();
    expect(validateVideoSettings({ ...base, purpose: 'promo' }).ok).toBe(false);
    expect(validateVideoSettings({ ...base, trim: { start: 5, end: 2 } })).toEqual({ ok: false, errors: ['trim.end: must be after the start'] });
    expect(validateVideoSettings({ ...base, formats: [] }).ok).toBe(false);
    expect(validateVideoSettings({ ...base, texts: { 'pt-BR': 'Olá' } })).toEqual({ ok: false, errors: ['texts.pt-BR: not a supported locale'] });
    const workspace = await workspaceFactory();
    writeFileSync(path.join(workspace.root, 'video.json'), '{ broken');
    expect(await readVideoSettings(workspace)).toEqual(defaultVideoSettings());
  });
});

describe('Generated videos are served in byte ranges', () => {
  test('reads the range forms browsers send and rejects ranges outside the file', () => {
    expect(byteRange(undefined, 100)).toBeUndefined();
    expect(byteRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(byteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(byteRange('bytes=-30', 100)).toEqual({ start: 70, end: 99 });
    expect(byteRange('bytes=200-', 100)).toBe('invalid');
    expect(byteRange('bytes=-0', 100)).toBe('invalid');
    // Several ranges and an invalid one are ignored: the whole file is sent.
    expect(byteRange('bytes=0-1,5-6', 100)).toBeUndefined();
    expect(byteRange('bytes=10-2', 100)).toBeUndefined();
  });

  test('answers 206 with the asked part of a generated MP4, and the settings API stores the options', async () => {
    const workspace = await workspaceFactory();
    const bytes = new Uint8Array(Array.from({ length: 64 }, (_, i) => i));
    const entry = await registerOutput(workspace, { specId: 'web.video.square', locale: 'de-DE', order: 1, name: 'demo', extension: 'mp4', bytes });
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const url = `/api/output/file?path=${encodeURIComponent(entry.path)}`;
    const part = await app.request(url, { headers: { range: 'bytes=8-15' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 8-15/64');
    expect(part.headers.get('content-type')).toBe('video/mp4');
    expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect((await app.request(url, { headers: { range: 'bytes=99-' } })).status).toBe(416);

    const put = await app.request('/api/video/settings', { method: 'PUT', body: JSON.stringify({ ...defaultVideoSettings(), cardSeconds: 3 }), headers: { 'content-type': 'application/json' } });
    expect(put.status).toBe(200);
    expect(await (await app.request('/api/video/settings')).json()).toMatchObject({ cardSeconds: 3 });
    const bad = await app.request('/api/video/settings', { method: 'PUT', body: JSON.stringify({ ...defaultVideoSettings(), cardSeconds: 9 }), headers: { 'content-type': 'application/json' } });
    expect(bad.status).toBe(400);
  });
});
