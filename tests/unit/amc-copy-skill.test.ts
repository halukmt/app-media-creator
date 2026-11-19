// conventions: RULE-TESTING-3301
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { COPY_LIMITS, createJob, readJob, type Brief } from '../../src/core/jobs/index.js';
import { readScreenshotSets, saveInput, saveProject, saveScreenshotSets, type Workspace } from '../../src/core/workspace/index.js';
import { headlineVariants } from '../factories/jobs.js';
import { appScreenshot } from '../factories/screenshots.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const SKILL = path.join('skills', 'amc-copy');
const CHECK = path.join(SKILL, 'scripts', 'check.mjs');

/** German source with two screenshots, German and Turkish, one forbidden claim. */
async function jobFolder(): Promise<{ workspace: Workspace; folder: string; id: string; inputs: string[] }> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], claims: { allowed: [], forbidden: ['beste App'] } }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  for (const name of ['start.png', 'teams.png']) {
    await saveInput(workspace, 'de-DE', { kind: 'screenshot', locale: 'de-DE', originalName: name, bytes: await appScreenshot(120, 260) });
  }
  const job = await createJob(workspace);
  const brief = JSON.parse(readFileSync(path.join(job.folder, 'brief.json'), 'utf8')) as Brief;
  return { workspace, folder: job.folder, id: job.id, inputs: brief.screenshots['de-DE']!.map((s) => s.input) };
}

const check = (folder: string) => spawnSync(process.execPath, [CHECK, folder], { encoding: 'utf8' });

describe('The amc-copy skill ships with the package', () => {
  test('has a SKILL.md with name and description, and every file it points to exists', () => {
    const skill = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
    const frontmatter = skill.split('---')[1] ?? '';
    expect(frontmatter).toMatch(/^name: amc-copy$/m);
    expect(frontmatter).toMatch(/^description: .{40,}/m);
    expect(existsSync(path.join(SKILL, 'references', 'copy-rules.md'))).toBe(true);
    expect(existsSync(CHECK)).toBe(true);
    // package.json ships the folder, so `npx app-media-creator` users get it too.
    expect((JSON.parse(readFileSync('package.json', 'utf8')) as { files: string[] }).files).toContain('skills/');
  });

  test('is the skill the UI tells the user to run', async () => {
    const { workspace, id } = await jobFolder();
    expect((await readJob(workspace, id)).command).toMatch(/^\/amc-copy "/);
  });
});

describe('The brief gives the copy limits of each slot\'s layout', () => {
  test('uses the project layout and a slot override', async () => {
    const { workspace } = await jobFolder();
    const sets = await readScreenshotSets(workspace);
    const [first, second] = sets.sets['de-DE']!;
    const saved = await saveScreenshotSets(workspace, { ...sets, sets: { 'de-DE': [first!, { ...second!, layout: 'text-top-large' }] } });
    expect(saved.ok).toBe(true);
    const job = await createJob(workspace);
    const slots = (JSON.parse(readFileSync(path.join(job.folder, 'brief.json'), 'utf8')) as Brief).screenshots['de-DE']!;
    expect(slots.map((s) => [s.layout, s.limits])).toEqual([
      ['text-top', COPY_LIMITS['text-top']],
      ['text-top-large', COPY_LIMITS['text-top-large']],
    ]);
  });
});

describe('The skill\'s check script agrees with the tool', () => {
  test('passes a valid result and lists long headlines as warnings', async () => {
    const { workspace, folder, id, inputs } = await jobFolder();
    writeFileSync(path.join(folder, 'headlines.json'), JSON.stringify(headlineVariants({ 'de-DE': inputs, 'tr-TR': inputs }, { longFirst: true })));
    const run = check(folder);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/warning: de-DE slot 1 A: headline has \d+ characters/);
    expect(run.stdout).toMatch(/^OK: headlines.json is valid/m);
    expect((await readJob(workspace, id)).status).toBe('ready');
  });

  test('fails on a forbidden claim and an unknown screenshot, like the tool', async () => {
    const { workspace, folder, id, inputs } = await jobFolder();
    writeFileSync(path.join(folder, 'headlines.json'), JSON.stringify(headlineVariants({ 'de-DE': [...inputs, 'inputs/x.png'] }, { claim: 'Die beste App' })));
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/forbidden claim "beste App"/);
    expect(run.stderr).toMatch(/"inputs\/x\.png" is not a screenshot/);
    expect((await readJob(workspace, id)).status).toBe('invalid');
  });

  test('measures each slot against its own layout, in the script and in the tool', async () => {
    const { workspace, inputs } = await jobFolder();
    const sets = await readScreenshotSets(workspace);
    const [first, second] = sets.sets['de-DE']!;
    expect((await saveScreenshotSets(workspace, { ...sets, sets: { 'de-DE': [first!, { ...second!, layout: 'text-top-large' }] } })).ok).toBe(true);
    const job = await createJob(workspace);
    // 29 characters: within the text-top limit (30), over the text-top-large limit (26).
    const result = headlineVariants({ 'de-DE': inputs }) as { locales: Record<string, { slots: { A: { headline: string } }[] }> };
    for (const slot of result.locales['de-DE']!.slots) slot.A.headline = 'Teams fair in Sekunden teilen';
    writeFileSync(path.join(job.folder, 'headlines.json'), JSON.stringify(result));
    const run = check(job.folder);
    expect(run.status).toBe(0);
    expect(run.stdout).not.toMatch(/de-DE slot 1 A: headline/);
    expect(run.stdout).toMatch(/de-DE slot 2 A: headline has 29 characters \(recommended 26\)/);
    const warnings = (await readJob(workspace, job.id)).warnings;
    expect(warnings.some((w) => w.includes('slot 2 A') && w.includes('26 characters'))).toBe(true);
    expect(warnings.some((w) => w.includes('slot 1 A'))).toBe(false);
  });

  test('also rejects a claim the project forbade after the job was prepared, and more than 10 slots', async () => {
    const { workspace, folder, inputs } = await jobFolder();
    const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], claims: { allowed: [], forbidden: ['beste App', 'kostenlos'] } }));
    expect(saved.ok).toBe(true);
    writeFileSync(path.join(folder, 'headlines.json'), JSON.stringify(headlineVariants({ 'de-DE': [...inputs, ...Array.from({ length: 9 }, (_, i) => `inputs/x${i}.png`)] }, { claim: 'Ganz kostenlos' })));
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/forbidden claim "kostenlos"/);
    expect(run.stderr).toMatch(/de-DE: at most 10 slots/);
  });

  test('reports a result that is not a JSON object instead of crashing', async () => {
    const { folder } = await jobFolder();
    writeFileSync(path.join(folder, 'headlines.json'), 'null');
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/headlines.json must hold a JSON object/);
  });

  test('stops with exit code 2 outside a job folder and 1 without a result', async () => {
    expect(check(mkdtempSync(path.join(tmpdir(), 'amc-nojob-'))).status).toBe(2);
    const { folder } = await jobFolder();
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/headlines.json is missing/);
  });
});
