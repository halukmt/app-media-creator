// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { readManifest } from '../../src/core/export/index.js';
import { applyJob, createJob, readJob, type Brief } from '../../src/core/jobs/index.js';
import { getSpec } from '../../src/core/specs/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { promoWorkspace, writePromoVideo } from '../factories/promo.js';
import { hasFfmpeg, recordingBytes } from '../factories/video.js';

const FFMPEG = hasFfmpeg();
const briefOf = (folder: string) => JSON.parse(readFileSync(path.join(folder, 'brief.json'), 'utf8')) as Brief;
/** A 16:9 stand-in for a brag render: the promo size, 11 s, 10 fps keep it quick. */
const landscape = () => recordingBytes({ seconds: 11, width: 1920, height: 1080, fps: 10 });

describe('A promo video job briefs the amc-video skill (#22)', () => {
  test('asks for all three formats with their sizes, the website and the brag engine, and names the command', async () => {
    const workspace = await promoWorkspace();
    const job = await createJob(workspace, { task: 'promo-video', promo: { website: 'https://example.com/app' } });
    expect(job.command).toBe(`/amc-video "${job.folder}"`);
    const brief = briefOf(job.folder);
    expect(brief.promo).toMatchObject({ engine: 'brag', fps: 30, seconds: { min: 15, max: 30 }, sources: { website: 'https://example.com/app' }, output: 'videos/<locale>/<format>.mp4' });
    // The 16:9 reel is also the Play YouTube file: it must fit both specs (10–60 s).
    expect(brief.promo?.formats).toEqual([
      { format: 'landscape', specId: 'web.promo.landscape', specIds: ['web.promo.landscape', 'google.promo-video'], width: 1920, height: 1080, minSeconds: 10, maxSeconds: 60 },
      { format: 'vertical', specId: 'web.promo.vertical', specIds: ['web.promo.vertical'], width: 1080, height: 1920, minSeconds: 5, maxSeconds: 60 },
      { format: 'square', specId: 'web.promo.square', specIds: ['web.promo.square'], width: 1080, height: 1080, minSeconds: 5, maxSeconds: 60 },
    ]);
    expect(brief.project.locales).toEqual(['de-DE', 'tr-TR']);
    expect(job.status).toBe('waiting');
  });

  test('gives Google Play alone only the 16:9 YouTube video and works from a repository without uploads', async () => {
    const workspace = await promoWorkspace({ web: false, screenshot: false });
    const job = await createJob(workspace, { task: 'promo-video', promo: { formats: ['vertical'], repo: 'https://github.com/example/app' } });
    expect(briefOf(job.folder).promo?.formats).toMatchObject([{ format: 'landscape', specIds: ['google.promo-video'], minSeconds: 10, maxSeconds: 120 }]);
  });

  test('refuses a job without material and without a store or channel for promo videos', async () => {
    await expect(createJob(await promoWorkspace({ screenshot: false }), { task: 'promo-video' })).rejects.toThrow(/Upload screenshots or a screen recording/);
    await expect(createJob(await promoWorkspace({ web: false, google: false }), { task: 'promo-video' })).rejects.toThrow('Turn on Google Play or Web / social');
  });

  test('rejects unknown formats, non-web URLs and promo options for other tasks in the API', async () => {
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace: await promoWorkspace() });
    const post = (body: unknown) => app.request('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post({ task: 'promo-video', promo: { formats: ['portrait'] } })).status).toBe(400);
    expect((await post({ task: 'promo-video', promo: { website: 'file:///etc/passwd' } })).status).toBe(400);
    expect((await post({ task: 'promo-video', promo: { repo: 'https://user:secret@example.com/repo' } })).status).toBe(400);
    expect((await post({ task: 'copy', promo: {} })).status).toBe(400);
    expect((await post({ task: 'promo-video', promo: { formats: ['square'] } })).status).toBe(201);
  });
});

describe.skipIf(!FFMPEG)('Rendered promo videos are checked and added to the outputs (#22)', () => {
  test('adds a checked 16:9 video as the web promo and the Play YouTube file, then counts the job as applied', async () => {
    const workspace = await promoWorkspace();
    const job = await createJob(workspace, { task: 'promo-video', promo: { formats: ['landscape'] } });
    writePromoVideo(job.folder, 'de-DE', 'landscape.mp4', landscape());
    // Music credits and OS metadata next to the videos are fine.
    writePromoVideo(job.folder, '.', 'CREDITS.txt', new TextEncoder().encode('Music: Track by Artist, CC BY 4.0'));
    writePromoVideo(job.folder, 'de-DE', '.DS_Store', new Uint8Array([0]));
    const ready = await readJob(workspace, job.id);
    expect(ready.status).toBe('ready');
    expect(ready.promoVideos).toMatchObject([{ locale: 'de-DE', format: 'landscape', path: 'videos/de-DE/landscape.mp4', width: 1920, height: 1080 }]);
    // Turkish is not rendered yet: a warning, not an error.
    expect(ready.warnings).toContain('tr-TR: no landscape video yet');

    expect(await applyJob(workspace, job.id)).toEqual({ locales: ['de-DE'] });
    const entries = (await readManifest(workspace)).entries.map((e) => [e.specId, e.path]);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['web.promo.landscape', 'web/de-DE/promo-landscape/01-promo.mp4'],
        ['google.promo-video', 'google/de-DE/promo-video/01-promo.mp4'],
      ]),
    );
    expect((await readJob(workspace, job.id)).status).toBe('applied');
    expect(getSpec('google.promo-video').verified).toBe(false);
  }, 120_000);

  test('reports a video in the wrong size, another name or language, and never applies the job', async () => {
    const workspace = await promoWorkspace();
    const job = await createJob(workspace, { task: 'promo-video', promo: { formats: ['landscape', 'square'] } });
    // A 16:9 video saved as the square one.
    const wrong = landscape();
    writePromoVideo(job.folder, 'de-DE', 'square.mp4', wrong);
    writePromoVideo(job.folder, 'de-DE', 'teaser.mp4', wrong);
    writePromoVideo(job.folder, 'fr-FR', 'landscape.mp4', wrong);
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('invalid');
    expect(state.errors.join('\n')).toMatch(/videos\/de-DE\/square\.mp4: .*1920.*1080/);
    expect(state.errors).toContain('videos/de-DE/teaser.mp4: not a video of this job (landscape.mp4, square.mp4)');
    expect(state.errors).toContain('videos/fr-FR: not a language folder of this job');
    expect(state.promoVideos).toBeUndefined();
    await expect(applyJob(workspace, job.id)).rejects.toThrow(/invalid results/);
    expect((await readManifest(workspace)).entries).toEqual([]);
  }, 120_000);

  test('rejects a 16:9 reel too short for the Play YouTube file although it would do for the web', async () => {
    const workspace = await promoWorkspace();
    const job = await createJob(workspace, { task: 'promo-video', promo: { formats: ['landscape'] } });
    writePromoVideo(job.folder, 'de-DE', 'landscape.mp4', recordingBytes({ seconds: 7, width: 1920, height: 1080, fps: 10 }));
    const state = await readJob(workspace, job.id);
    expect(state.status).toBe('invalid');
    expect(state.errors.join('\n')).toMatch(/videos\/de-DE\/landscape\.mp4: .*10/);
  }, 120_000);
});
