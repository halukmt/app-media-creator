// conventions: RULE-TESTING-3301
import { tempDir } from '../factories/temp.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { openWorkspace, readProject, saveProject } from '../../src/core/workspace/index.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

describe('openWorkspace prepares the workspace folder', () => {
  test('creates project.json, inputs, jobs, output and exports on first start, named after the repo folder', async () => {
    const workspace = await workspaceFactory();
    for (const folder of ['inputs', 'jobs', 'output', 'exports']) expect(existsSync(path.join(workspace.root, folder))).toBe(true);
    expect((await readProject(workspace)).name).toBe('demo-repo');
  });

  test('keeps the settings of an existing workspace', async () => {
    const workspace = await workspaceFactory();
    await saveProject(workspace, projectInputFactory({ name: 'Kept' }));
    const reopened = await openWorkspace(workspace.root);
    expect((await readProject(reopened)).name).toBe('Kept');
  });
});

describe('saveProject and readProject store the settings', () => {
  test('reads back exactly what was saved', async () => {
    const workspace = await workspaceFactory();
    const result = await saveProject(workspace, projectInputFactory({ name: 'Demo', locales: ['de-DE', 'tr-TR'], sourceLocale: 'de-DE' }));
    expect(result.ok).toBe(true);
    expect(await readProject(workspace)).toMatchObject({ name: 'Demo', locales: ['de-DE', 'tr-TR'] });
  });

  test('leaves the stored settings unchanged when the input is invalid', async () => {
    const workspace = await workspaceFactory();
    const before = readFileSync(workspace.projectFile, 'utf8');
    const result = await saveProject(workspace, projectInputFactory({ locales: ['pt-BR'] }));
    expect(result.ok).toBe(false);
    expect(readFileSync(workspace.projectFile, 'utf8')).toBe(before);
  });

  test('reports a damaged project.json', async () => {
    const workspace = await workspaceFactory();
    writeFileSync(workspace.projectFile, '{ not json');
    await expect(readProject(workspace)).rejects.toThrow('not valid JSON');
  });

  test('handles overlapping saves without losing either result', async () => {
    const workspace = await workspaceFactory();
    const results = await Promise.all(
      ['One', 'Two', 'Three'].map((name) => saveProject(workspace, projectInputFactory({ name }))),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await readProject(workspace)).name).toBe('Three');
  });

  test('uses a valid default name for a repo folder with a very long name', async () => {
    const root = path.join(tempDir('amc-ws-'), 'x'.repeat(150), '.app-media');
    const workspace = await openWorkspace(root);
    expect((await readProject(workspace)).name).toHaveLength(100);
  });
});
