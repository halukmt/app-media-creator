// conventions: RULE-TESTING-3301
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createJob } from '../../src/core/jobs/index.js';
import { promoWorkspace, writePromoVideo } from '../factories/promo.js';
import { tempDir } from '../factories/temp.js';
import { hasFfmpeg, recordingBytes } from '../factories/video.js';

const SKILL = path.join('skills', 'amc-video');
const CHECK = path.join(SKILL, 'scripts', 'check.mjs');
const check = (folder: string) => spawnSync(process.execPath, [CHECK, folder], { encoding: 'utf8' });

describe('The amc-video skill ships with the package (#22)', () => {
  test('has a SKILL.md for brag, its rules, the check script and the brag and HyperFrames notices', () => {
    const skill = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
    const frontmatter = skill.split('---')[1] ?? '';
    expect(frontmatter).toMatch(/^name: amc-video$/m);
    expect(frontmatter).toMatch(/^description: .{40,}/m);
    expect(skill).toContain('/plugin marketplace add latent-spaces/brag');
    expect(skill).toContain('--no-music');
    for (const file of ['references/promo-rules.md', 'scripts/check.mjs']) expect(existsSync(path.join(SKILL, file))).toBe(true);
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notices).toMatch(/brag[\s\S]*MIT/);
    expect(notices).toMatch(/HyperFrames[\s\S]*Apache-2\.0/);
    expect(skill + readFileSync(path.join(SKILL, 'references/promo-rules.md'), 'utf8')).not.toMatch(/remotion/i);
  });
});

describe('The skill\'s check script agrees with the tool (#22)', () => {
  test('stops with exit code 2 outside a job folder and for a job of another task', async () => {
    expect(check(tempDir('amc-nojob-')).status).toBe(2);
    const copyJob = await createJob(await promoWorkspace(), { task: 'copy' });
    expect(check(copyJob.folder).status).toBe(2);
  });

  test.skipIf(!hasFfmpeg())('passes a 16:9 video in its exact size and reports a wrong size and an unknown file', async () => {
    const job = await createJob(await promoWorkspace(), { task: 'promo-video', promo: { formats: ['landscape', 'square'] } });
    const video = recordingBytes({ seconds: 11, width: 1920, height: 1080, fps: 10 });
    writePromoVideo(job.folder, 'de-DE', 'landscape.mp4', video);
    const good = check(job.folder);
    expect(good.status, good.stdout).toBe(0);
    expect(good.stdout).toContain('warning: tr-TR: no landscape, square video yet');

    writePromoVideo(job.folder, 'de-DE', 'square.mp4', video);
    writePromoVideo(job.folder, 'de-DE', 'teaser.mp4', video);
    const bad = check(job.folder);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toContain('error: videos/de-DE/square.mp4: is 1920 × 1080; square must be exactly 1080 × 1080');
    expect(bad.stdout).toContain('error: videos/de-DE/teaser.mp4: not a video of this job (landscape.mp4, square.mp4)');
  }, 120_000);
});
