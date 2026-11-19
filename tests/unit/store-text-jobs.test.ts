// conventions: RULE-TESTING-3301
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { applyStoreTexts, createJob, listJobs, readJob, type Brief } from '../../src/core/jobs/index.js';
import { readStoreTexts, saveInput, saveProject, saveStoreTexts, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot } from '../factories/screenshots.js';
import { storeTextsDocument, writeStoreTextResults } from '../factories/store-texts.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

/** German source, German and Turkish, Google Play turned off, one forbidden claim, no screenshots. */
async function textWorkspace(): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const defaults = projectInputFactory().targets as Record<string, unknown>;
  const saved = await saveProject(
    workspace,
    projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], claims: { allowed: [], forbidden: ['beste App'] }, targets: { ...defaults, google: { enabled: false, devices: [] } } }),
  );
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  return workspace;
}

const briefOf = (folder: string) => JSON.parse(readFileSync(path.join(folder, 'brief.json'), 'utf8')) as Brief;

describe('A store texts job briefs the AI with the fields of the enabled stores', () => {
  test('lists the App Store fields with their limits and the current texts, without screenshots', async () => {
    const workspace = await textWorkspace();
    await saveStoreTexts(workspace, storeTextsDocument({ 'tr-TR': { 'apple-name': 'Teamfinder' } }));
    const job = await createJob(workspace, { task: 'store-texts' });
    expect(job.command).toBe(`/amc-store-texts "${job.folder}"`);
    expect(job.status).toBe('waiting');
    const brief = briefOf(job.folder);
    expect(brief.task).toBe('store-texts');
    expect(brief.storeTexts?.targets).toEqual(['apple']);
    expect(brief.storeTexts?.fields.map((f) => [f.field, f.max, f.unit])).toContainEqual(['apple-keywords', 100, 'bytes']);
    expect(brief.storeTexts?.fields.some((f) => f.target === 'google')).toBe(false);
    expect(brief.storeTexts?.current).toEqual({ 'tr-TR': { 'apple-name': 'Teamfinder' } });
    expect(brief.screenshots).toEqual({});
  });

  test('includes the screenshots with their headlines when there are any, and refuses without a store', async () => {
    const workspace = await textWorkspace();
    await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: 'start.png', bytes: await appScreenshot(120, 260) });
    const brief = briefOf((await createJob(workspace, { task: 'store-texts', locales: 'de-DE' })).folder);
    expect(brief.screenshots['de-DE']).toHaveLength(1);
    const off = { apple: { enabled: false, devices: [] }, google: { enabled: false, devices: [] }, web: { enabled: true, devices: [] } };
    await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE'], targets: off }));
    await expect(createJob(workspace, { task: 'store-texts' })).rejects.toThrow(/App Store or Google Play/);
    await expect(createJob(workspace, { task: 'video' as never })).rejects.toThrow(/Unknown job task/);
  });
});

describe('Store text results are checked against the catalogue', () => {
  test('reports store limits and advice as warnings and keeps the job ready', async () => {
    const workspace = await textWorkspace();
    const job = await createJob(workspace, { task: 'store-texts' });
    writeStoreTextResults(job.folder, { 'tr-TR': { 'apple-subtitle': 'ç'.repeat(31), 'google-title': 'Teamfinder' } });
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('ready');
    expect(state.warnings).toEqual([
      'store-texts/tr-TR/google-title.md: App name is not a field of the stores in this job',
      'store-texts/tr-TR/apple-subtitle.md: Subtitle has 31 characters; the store allows 30',
    ]);
  });

  test('makes the job invalid for a forbidden claim', async () => {
    const workspace = await textWorkspace();
    const job = await createJob(workspace, { task: 'store-texts' });
    writeStoreTextResults(job.folder, { 'de-DE': { 'apple-description': 'Die beste App für Teams.' } });
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('invalid');
    expect(state.errors).toEqual(['store-texts/de-DE/apple-description.md: uses the forbidden claim "beste App"']);
  });
});

describe('Applying store texts merges the written fields', () => {
  test('replaces only the fields of the result, marks the job applied, and a rewrite is a new result', async () => {
    const workspace = await textWorkspace();
    await saveStoreTexts(workspace, storeTextsDocument({ 'de-DE': { 'apple-subtitle': 'Faire Teams', 'apple-description': 'Alt' } }));
    const job = await createJob(workspace, { task: 'store-texts' });
    writeStoreTextResults(job.folder, { 'de-DE': { 'apple-description': 'Neu' } });
    expect(await applyStoreTexts(workspace, job.id)).toEqual({ locales: ['de-DE'], fields: 1 });
    expect((await readStoreTexts(workspace)).texts['de-DE']).toEqual({ 'apple-subtitle': 'Faire Teams', 'apple-description': 'Neu' });
    const applied = await readJob(workspace, job.id);
    expect(applied.status).toBe('applied');
    expect(applied.applied?.variant).toBeUndefined();
    writeFileSync(path.join(job.folder, 'store-texts', 'de-DE', 'apple-description.md'), 'Neuer');
    expect((await readJob(workspace, job.id)).status).toBe('ready');
  });

  test('refuses a job without store texts or with invalid ones', async () => {
    const workspace = await textWorkspace();
    const job = await createJob(workspace, { task: 'store-texts' });
    await expect(applyStoreTexts(workspace, job.id)).rejects.toThrow(/no store texts yet/);
    writeStoreTextResults(job.folder, { 'de-DE': { 'apple-name': 'beste App' } });
    await expect(applyStoreTexts(workspace, job.id)).rejects.toThrow(/invalid results/);
  });
});

describe('Jobs are listed per task', () => {
  test('finds the newest copy job behind a newer store texts job, in core and over HTTP', async () => {
    const workspace = await textWorkspace();
    await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: 'start.png', bytes: await appScreenshot(120, 260) });
    const copy = await createJob(workspace, { task: 'copy' }, { now: new Date('2026-11-19T10:00:00') });
    const texts = await createJob(workspace, { task: 'store-texts' }, { now: new Date('2026-11-19T11:00:00') });
    expect((await listJobs(workspace, 1, 'copy')).map((job) => job.id)).toEqual([copy.id]);
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const get = async (query: string) => app.request(`http://localhost:4790/api/jobs${query}`);
    expect(((await (await get('?task=store-texts&limit=1')).json()) as { id: string }[]).map((job) => job.id)).toEqual([texts.id]);
    expect((await get('?task=video')).status).toBe(400);
  });

  test('creates and applies a store texts job over HTTP without a variant', async () => {
    const workspace = await textWorkspace();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const post = (url: string, body: unknown) => app.request(`http://localhost:4790/api${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post('/jobs', { task: 'poem' })).status).toBe(400);
    expect((await post('/jobs/20261119-000000-zzzz/apply', {})).status).toBe(404);
    const created = await post('/jobs', { task: 'store-texts', locales: ['tr-TR'] });
    expect(created.status).toBe(201);
    const job = (await created.json()) as { id: string; folder: string; locales: string[] };
    expect(job.locales).toEqual(['tr-TR']);
    writeStoreTextResults(job.folder, { 'tr-TR': { 'apple-name': 'Teamfinder' } });
    const applied = await post(`/jobs/${job.id}/apply`, {});
    expect(applied.status).toBe(200);
    expect((await readStoreTexts(workspace)).texts['tr-TR']).toEqual({ 'apple-name': 'Teamfinder' });
  });
});
