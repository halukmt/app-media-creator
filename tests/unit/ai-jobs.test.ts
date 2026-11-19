// conventions: RULE-TESTING-3301
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { applyHeadlines, createJob, extractFrames, listJobs, readJob, type Brief, type RunProgram } from '../../src/core/jobs/index.js';
import { readScreenshotSets, saveInput, saveProject, saveScreenshotSets, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { watchJobs } from '../../src/server/jobs-routes.js';
import { headlineVariants } from '../factories/jobs.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { appScreenshot } from '../factories/screenshots.js';
import { mp4Bytes, projectInputFactory, workspaceFactory } from '../factories/workspace.js';

/** German source with two screenshots, German and Turkish, and a forbidden claim. */
async function jobWorkspace(): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], claims: { allowed: [], forbidden: ['beste App'] } }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  for (const name of ['start.png', 'teams.png']) {
    await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: name, bytes: await appScreenshot(120, 260) });
  }
  return workspace;
}

const brief = (folder: string) => JSON.parse(readFileSync(path.join(folder, 'brief.json'), 'utf8')) as Brief;
const write = (folder: string, file: string, data: unknown) => {
  mkdirSync(path.dirname(path.join(folder, file)), { recursive: true });
  writeFileSync(path.join(folder, file), typeof data === 'string' ? data : JSON.stringify(data));
};

/** A fake ffmpeg that "extracts" two frames, or fails as if it were not installed. */
const fakeFfmpeg = (mode: 'frames' | 'missing'): RunProgram => async (_file, args) => {
  if (mode === 'missing') throw Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
  const pattern = args[args.length - 1]!;
  for (const n of ['01', '02']) writeFileSync(pattern.replace('%02d', n), 'jpg');
};

describe('createJob prepares an AI job folder', () => {
  test('writes the brief with each language\'s screenshots, the claims, the images and the result schemas', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace, { locales: ['de-DE', 'tr-TR'] });
    expect(job.status).toBe('waiting');
    expect(job.command).toBe(`/amc-copy "${job.folder}"`);
    const b = brief(job.folder);
    expect(b.screenshots['de-DE']?.map((s) => [s.slot, s.fallbackInput])).toEqual([[1, false], [2, false]]);
    // Turkish has no own screenshots: the German ones, marked as fallback input, copied only once.
    expect(b.screenshots['tr-TR']?.map((s) => s.fallbackInput)).toEqual([true, true]);
    expect(b.screenshots['tr-TR']?.[0]?.image).toBe(b.screenshots['de-DE']?.[0]?.image);
    expect(existsSync(path.join(job.folder, b.screenshots['de-DE']![0]!.image))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(job.folder, 'claims.json'), 'utf8'))).toEqual({ allowed: [], forbidden: ['beste App'] });
    expect(JSON.parse(readFileSync(path.join(job.folder, 'schemas/headlines.schema.json'), 'utf8')).type).toBe('object');
  });

  test('adds video frames, or notes in the brief that ffmpeg is missing', async () => {
    const workspace = await jobWorkspace();
    // ffmpeg is faked at the module boundary: the video bytes only need to pass the upload check.
    await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'demo.mp4', bytes: mp4Bytes() });
    const withFrames = await createJob(workspace, {}, { run: fakeFfmpeg('frames') });
    expect(brief(withFrames.folder).videos[0]?.frames).toEqual(['frames/01-demo/frame-01.jpg', 'frames/01-demo/frame-02.jpg']);
    const without = await createJob(workspace, {}, { run: fakeFfmpeg('missing') });
    expect(brief(without.folder).videos).toEqual([]);
    expect(brief(without.folder).notes.join(' ')).toMatch(/ffmpeg was not found/);
    expect((await readJob(workspace, without.id)).warnings.join(' ')).toMatch(/video frames are missing/);
  });

  test('rejects a language outside the project and a project without screenshots', async () => {
    const workspace = await jobWorkspace();
    await expect(createJob(workspace, { locales: ['fr-FR'] })).rejects.toThrow(/fr-FR is not a language of this project/);
    await expect(createJob(await workspaceFactory())).rejects.toThrow(/Upload screenshots/);
  });
});

describe('readJob validates the results before anything is applied', () => {
  test('reports valid headlines as ready, with a warning for a long headline', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    const slots = brief(job.folder).screenshots['de-DE']!;
    write(job.folder, 'headlines.json', headlineVariants({ 'de-DE': slots.map((s) => s.input) }, { longFirst: true }));
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('ready');
    expect(state.errors).toEqual([]);
    expect(state.warnings.join(' ')).toMatch(/longer than 30 characters/);
    expect(state.headlines?.locales['de-DE']?.slots).toHaveLength(2);
  });

  test('marks broken JSON, unknown screenshots and forbidden claims as invalid and exposes no results', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    write(job.folder, 'headlines.json', '{ not json');
    expect((await readJob(workspace, job.id)).errors).toEqual(['headlines.json: not valid JSON']);

    const inputs = brief(job.folder).screenshots['de-DE']!.map((s) => s.input);
    write(job.folder, 'headlines.json', headlineVariants({ 'de-DE': [...inputs, 'inputs/screenshots/de-DE/other.png'] }, { claim: 'Die beste App für Teams' }));
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('invalid');
    expect(state.errors.join(' ')).toMatch(/other\.png, which is not a screenshot of this job/);
    expect(state.errors.join(' ')).toMatch(/forbidden claim "beste App"/);
    expect(state.headlines).toBeUndefined();
  });

  test('reads store texts by field and rejects unknown files', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    write(job.folder, 'store-texts/tr-TR/apple-subtitle.md', 'Adil takımlar saniyeler içinde\n');
    expect((await readJob(workspace, job.id)).storeTexts).toEqual({ 'tr-TR': { 'apple-subtitle': 'Adil takımlar saniyeler içinde' } });
    write(job.folder, 'store-texts/tr-TR/slogan.md', 'x');
    expect((await readJob(workspace, job.id)).errors.join(' ')).toMatch(/slogan\.md: not a store text field/);
  });

  test('accepts a storyboard of job images and rejects a scene with an unknown image', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    const image = brief(job.folder).screenshots['de-DE']![0]!.image;
    write(job.folder, 'storyboard.json', { version: 1, scenes: [{ image, seconds: 3, captions: { 'de-DE': 'Teams in Sekunden' } }] });
    expect((await readJob(workspace, job.id)).status).toBe('ready');
    write(job.folder, 'storyboard.json', { version: 1, scenes: [{ image: '../../project.json', seconds: 3, captions: {} }] });
    expect((await readJob(workspace, job.id)).errors.join(' ')).toMatch(/not an image of this job/);
  });

  test('reports store-texts written as a file as an invalid result and keeps the job list working (#84)', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    write(job.folder, 'store-texts', 'not a folder');
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('invalid');
    expect(state.errors).toEqual(['store-texts: must be a folder with one folder per language']);
    expect((await listJobs(workspace)).map((j) => j.status)).toEqual(['invalid']);
  });

  test('refuses ids that are not job folders', async () => {
    const workspace = await jobWorkspace();
    await expect(readJob(workspace, '../project')).rejects.toThrow(/not a job id/);
    expect(await listJobs(workspace)).toEqual([]);
  });
});

describe('applyHeadlines writes one variant into the screenshot sets', () => {
  test('applies variant B for German and Turkish; Turkish gets its own set with the German screenshots', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    const b = brief(job.folder);
    const inputs = b.screenshots['de-DE']!.map((s) => s.input);
    write(job.folder, 'headlines.json', headlineVariants({ 'de-DE': inputs, 'tr-TR': inputs }));
    const before = (await readScreenshotSets(workspace)).revision;
    expect(await applyHeadlines(workspace, job.id, 'B')).toEqual({ locales: ['de-DE', 'tr-TR'] });
    const sets = await readScreenshotSets(workspace);
    // A page still based on the earlier revision cannot save over the applied headlines (#85).
    expect(sets.revision).toBe(before + 1);
    expect(sets.sets['de-DE']?.map((e) => e.headline)).toEqual(['de-DE B 1', 'de-DE B 2']);
    expect(sets.sets['tr-TR']?.map((e) => [e.input, e.headline])).toEqual(inputs.map((input, i) => [input, `tr-TR B ${i + 1}`]));
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('applied');
    expect(state.applied?.variant).toBe('B');
  });

  test('keeps the screenshots the result leaves out, the current order and the style overrides', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    const inputs = brief(job.folder).screenshots['de-DE']!.map((s) => s.input);
    // After the job was prepared: the German set is reordered and slot "teams" gets no frame.
    const before = await readScreenshotSets(workspace);
    const reordered = [...before.sets['de-DE']!].reverse().map((entry) => (entry.input === inputs[1] ? { ...entry, frame: 'none' as const } : entry));
    expect((await saveScreenshotSets(workspace, { ...before, sets: { 'de-DE': reordered } })).ok).toBe(true);
    // The result covers only the first screenshot, for German and the fallback language Turkish.
    write(job.folder, 'headlines.json', headlineVariants({ 'de-DE': [inputs[0]!], 'tr-TR': [inputs[0]!] }));
    await applyHeadlines(workspace, job.id, 'A');
    const sets = await readScreenshotSets(workspace);
    for (const locale of ['de-DE', 'tr-TR'] as const) {
      expect(sets.sets[locale]?.map((e) => [e.input, e.headline, e.frame])).toEqual([
        [inputs[1], '', 'none'],
        [inputs[0], `${locale} A 1`, undefined],
      ]);
    }
  });

  test('treats a rewritten result as new instead of already applied', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    const inputs = brief(job.folder).screenshots['de-DE']!.map((s) => s.input);
    const applied = JSON.stringify(headlineVariants({ 'de-DE': inputs }));
    write(job.folder, 'headlines.json', applied);
    await applyHeadlines(workspace, job.id, 'A');
    expect((await readJob(workspace, job.id)).status).toBe('applied');
    // The fingerprint is the one of the text that was validated and applied (#84).
    const record = JSON.parse(readFileSync(path.join(job.folder, 'applied.json'), 'utf8')) as { headlines: string };
    expect(record.headlines).toBe(createHash('sha256').update(applied).digest('hex'));
    write(job.folder, 'headlines.json', headlineVariants({ 'de-DE': inputs }, { longFirst: true }));
    expect((await readJob(workspace, job.id)).status).toBe('ready');
  });

  test('refuses a job without headlines and a job with invalid results', async () => {
    const workspace = await jobWorkspace();
    const job = await createJob(workspace);
    await expect(applyHeadlines(workspace, job.id, 'A')).rejects.toThrow(/has no headlines yet/);
    write(job.folder, 'headlines.json', '[]');
    await expect(applyHeadlines(workspace, job.id, 'A')).rejects.toThrow(/has invalid results/);
  });
});

describe('The jobs folder watcher and API', () => {
  test('reports a changed job once by its id and ignores other folders', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'amc-jobs-'));
    const id = '20261119-120000-abcd';
    mkdirSync(path.join(dir, id));
    mkdirSync(path.join(dir, 'notes'));
    const seen: string[] = [];
    const stop = watchJobs(dir, (changed) => seen.push(changed));
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      writeFileSync(path.join(dir, 'notes', 'x.txt'), 'x');
      writeFileSync(path.join(dir, id, 'headlines.json'), '{}');
      writeFileSync(path.join(dir, id, 'headlines.json'), '{"a":1}');
      await expect.poll(() => seen, { timeout: 3000 }).toEqual([id]);
    } finally {
      stop();
    }
  });

  test('creates, lists and applies jobs through the API and answers 400 for a bad variant', async () => {
    const workspace = await jobWorkspace();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const post = (url: string, body: unknown) => app.request(`http://localhost:4790${url}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const created = await post('/api/jobs', { locales: ['de-DE'] });
    expect(created.status).toBe(201);
    const job = (await created.json()) as { id: string; command: string };
    expect(job.command).toMatch(/^\/amc-copy "/);
    const list = (await (await app.request('http://localhost:4790/api/jobs')).json()) as { id: string }[];
    expect(list.map((j) => j.id)).toEqual([job.id]);
    expect((await post(`/api/jobs/${job.id}/apply`, { variant: 'C' })).status).toBe(400);
    expect((await post(`/api/jobs/${job.id}/apply`, { variant: 'A' })).status).toBe(409);
    expect((await app.request('http://localhost:4790/api/jobs/not-a-job')).status).toBe(404);
  });
});

const hasFfmpeg = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version']).status === 0;

describe('extractFrames with the real ffmpeg', () => {
  test.skipIf(!hasFfmpeg)('takes one frame every two seconds from a 5 second video', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'amc-frames-'));
    const video = path.join(dir, 'clip.mp4');
    const made = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=5:size=320x640:rate=10', '-pix_fmt', 'yuv420p', video]);
    expect(made.status).toBe(0);
    const frames = await extractFrames(video, path.join(dir, 'frames'));
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0]).toBe('frame-01.jpg');
  });

  test('reports a missing ffmpeg', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'amc-frames-'));
    await expect(extractFrames(path.join(dir, 'clip.mp4'), path.join(dir, 'f'), fakeFfmpeg('missing'))).rejects.toThrow(/ffmpeg was not found/);
  });
});
