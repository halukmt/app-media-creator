// conventions: RULE-TESTING-3301
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { createJob, readJob } from '../../src/core/jobs/index.js';
import { STORE_TEXT_FIELDS } from '../../src/core/specs/index.js';
import { saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { storeListingTexts, writeStoreTextResults } from '../factories/store-texts.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const SKILL = path.join('skills', 'amc-store-texts');
const CHECK = path.join(SKILL, 'scripts', 'check.mjs');
const check = (folder: string) => spawnSync(process.execPath, [CHECK, folder], { encoding: 'utf8' });

/** A store texts job for German and Turkish, both stores, one forbidden claim. */
async function textJob(): Promise<{ workspace: Workspace; folder: string; id: string }> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'], claims: { allowed: [], forbidden: ['beste App'] } }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  const job = await createJob(workspace, { task: 'store-texts' });
  return { workspace, folder: job.folder, id: job.id };
}

describe('The amc-store-texts skill ships with the package', () => {
  test('has a SKILL.md, its references, the check script and the humanizer credit', () => {
    const skill = readFileSync(path.join(SKILL, 'SKILL.md'), 'utf8');
    const frontmatter = skill.split('---')[1] ?? '';
    expect(frontmatter).toMatch(/^name: amc-store-texts$/m);
    expect(frontmatter).toMatch(/^description: .{40,}/m);
    for (const file of ['references/store-text-rules.md', 'references/humanizer-light.md', 'scripts/check.mjs']) expect(existsSync(path.join(SKILL, file))).toBe(true);
    const notices = readFileSync('THIRD_PARTY_NOTICES.md', 'utf8');
    expect(notices).toMatch(/ste80-humanizer[\s\S]*Copyright \(c\) 2026 Dodaios/);
    expect(notices).toMatch(/blader\/humanizer[\s\S]*Copyright \(c\) 2025 Siqi Chen/);
  });
});

describe('The skill\'s check script agrees with the tool', () => {
  test('passes a valid listing with every known field and reports the store limits as warnings', async () => {
    const { workspace, folder, id } = await textJob();
    const texts = storeListingTexts();
    const all = Object.fromEntries(STORE_TEXT_FIELDS.map((field) => [field, texts['de-DE']![field] ?? 'Teamfinder']));
    writeStoreTextResults(folder, { 'de-DE': { ...all, 'apple-subtitle': 'ş'.repeat(31) }, 'tr-TR': texts['tr-TR'] });
    const run = check(folder);
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/warning: store-texts\/de-DE\/apple-subtitle\.md: Subtitle has 31 characters; the store allows 30/);
    expect(run.stdout).toMatch(/warning: store-texts\/tr-TR: Short description \(google-short-description\) is required/);
    expect(run.stdout).toMatch(/^OK: the store texts are valid/m);
    const state = await readJob(workspace, id);
    expect(state.status).toBe('ready');
    expect(state.warnings).toContain('store-texts/de-DE/apple-subtitle.md: Subtitle has 31 characters; the store allows 30');
  });

  test('fails on a forbidden claim and an unknown field, like the tool', async () => {
    const { workspace, folder, id } = await textJob();
    writeStoreTextResults(folder, { 'de-DE': { 'apple-description': 'Die beste App.', 'apple-slogan': 'x' } as never });
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/apple-description\.md: uses the forbidden claim "beste App"/);
    expect(run.stderr).toMatch(/apple-slogan\.md: not a store text field/);
    expect((await readJob(workspace, id)).status).toBe('invalid');
  });

  test('stops with exit code 2 outside a store texts job and 1 before the texts are written', async () => {
    expect(check(mkdtempSync(path.join(tmpdir(), 'amc-nojob-'))).status).toBe(2);
    const { folder } = await textJob();
    const run = check(folder);
    expect(run.status).toBe(1);
    expect(run.stderr).toMatch(/store-texts\/ is missing/);
  });
});
