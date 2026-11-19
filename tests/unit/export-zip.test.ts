// conventions: RULE-TESTING-3301
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { describe, expect, test } from 'vitest';
import { ExportError, createExport, registerOutput, selectExportLocales } from '../../src/core/export/index.js';
import { defaultProject, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { measureFactory } from '../factories/export.js';
import { imagePropsFactory } from '../factories/media.js';
import { pngBytes, projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const measure = measureFactory({}, imagePropsFactory());

async function seed(workspace: Workspace) {
  const bytes = await pngBytes();
  await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes });
  for (const locale of ['de-DE', 'tr-TR']) {
    await registerOutput(workspace, { specId: 'apple.screenshot.iphone-6.3', locale, order: 1, name: 'start', extension: 'png', bytes });
  }
}

function zipNames(file: string): string[] {
  return Object.keys(unzipSync(readFileSync(file))).sort();
}

describe('createExport writes a ZIP for the selected locales', () => {
  test('exports one locale with the shared files and the checklist, without other locales', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    const result = await createExport(workspace, { locales: 'de-DE', measure, now: new Date('2026-11-18T10:00:00Z') });
    expect(result.fileName).toMatch(/^demo-repo-de-DE-2026-11-18T10-00-00-[0-9a-f]{4}.zip$/);
    expect(zipNames(result.file)).toEqual([
      'CHECKLIST.md',
      'apple/de-DE/iphone-6.3/01-start.png',
      'apple/shared/icon/app-icon.png',
    ]);
  });

  test('exports all locales of the project', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    const result = await createExport(workspace, { locales: 'all', measure });
    expect(result.fileName).toContain('-all-');
    expect(zipNames(result.file)).toContain('apple/tr-TR/iphone-6.3/01-start.png');
  });

  test('stores the file contents unchanged and a readable checklist', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    const result = await createExport(workspace, { locales: ['de-DE'], measure });
    const files = unzipSync(readFileSync(result.file));
    expect(files['apple/shared/icon/app-icon.png']).toEqual(new Uint8Array(await pngBytes()));
    expect(strFromU8(files['CHECKLIST.md']!)).toContain('# Export checklist: demo-repo');
  });

  test('leaves out files of a disabled target', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    await registerOutput(workspace, { specId: 'google.icon', order: 1, name: 'icon', extension: 'png', bytes: await pngBytes() });
    const project = { ...defaultProject('demo-repo') };
    project.targets = { ...project.targets, google: { enabled: false, devices: [] } };
    await saveProject(workspace, project);
    const result = await createExport(workspace, { locales: 'de-DE', measure });
    expect(zipNames(result.file).some((name) => name.startsWith('google/'))).toBe(false);
  });

  test('never exports a file outside the output folder named in a hand-edited manifest', async () => {
    const workspace = await workspaceFactory();
    writeFileSync(path.join(workspace.root, 'secret.txt'), 'private');
    writeFileSync(
      path.join(workspace.outputDir, 'manifest.json'),
      JSON.stringify({ version: 1, entries: [{ specId: 'apple.icon', order: 1, name: 'x', path: '../secret.txt', fallbackInput: false }] }),
    );
    const result = await createExport(workspace, { locales: 'de-DE', measure });
    expect(zipNames(result.file)).toEqual(['CHECKLIST.md']);
    expect(result.checklist.problems[0]).toContain('../secret.txt');
  });

  test('never follows a link in the output folder to a file elsewhere', async () => {
    const workspace = await workspaceFactory();
    const secret = path.join(workspace.root, 'secret.png');
    writeFileSync(secret, await pngBytes());
    const linkPath = path.join(workspace.outputDir, 'apple/shared/icon/app-icon.png');
    mkdirSync(path.dirname(linkPath), { recursive: true });
    try {
      symlinkSync(secret, linkPath);
    } catch {
      return; // Creating symlinks needs extra rights on Windows; the check is covered on Linux CI.
    }
    writeFileSync(
      path.join(workspace.outputDir, 'manifest.json'),
      JSON.stringify({ version: 1, entries: [{ specId: 'apple.icon', order: 1, name: 'app-icon', path: 'apple/shared/icon/app-icon.png', fallbackInput: false }] }),
    );
    const result = await createExport(workspace, { locales: 'de-DE', measure });
    expect(zipNames(result.file)).toEqual(['CHECKLIST.md']);
  });

  test('keeps a file named home.dark through the manifest and into the ZIP', async () => {
    const workspace = await workspaceFactory();
    await registerOutput(workspace, {
      specId: 'apple.screenshot.iphone-6.3',
      locale: 'de-DE',
      order: 1,
      name: 'home.dark',
      extension: 'png',
      bytes: await pngBytes(),
    });
    const result = await createExport(workspace, { locales: 'de-DE', measure });
    expect(zipNames(result.file)).toContain('apple/de-DE/iphone-6.3/01-home.dark.png');
    expect(result.checklist.problems).toEqual([]);
  });

  test('ends with an error and leaves no ZIP when the exports folder cannot be written', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    rmSync(workspace.exportsDir, { recursive: true });
    writeFileSync(workspace.exportsDir, 'not a folder');
    await expect(createExport(workspace, { locales: 'de-DE', measure })).rejects.toThrow();
    expect(readFileSync(workspace.exportsDir, 'utf8')).toBe('not a folder');
  });

  test('skips a registered file that was deleted and still writes a valid ZIP', async () => {
    const workspace = await workspaceFactory();
    await seed(workspace);
    const { rmSync } = await import('node:fs');
    rmSync(`${workspace.outputDir}/apple/de-DE/iphone-6.3/01-start.png`);
    const result = await createExport(workspace, { locales: 'de-DE', measure: measureFactory({}, imagePropsFactory()) });
    expect(zipNames(result.file)).toEqual(['CHECKLIST.md', 'apple/shared/icon/app-icon.png']);
  });
});

describe('selectExportLocales checks the selection against the project', () => {
  const project = { ...defaultProject('Demo'), locales: ['de-DE', 'en-US'] as const } as ReturnType<typeof defaultProject>;

  test('uses all project locales for "all" and for no selection', () => {
    expect(selectExportLocales(project, 'all')).toEqual(['de-DE', 'en-US']);
    expect(selectExportLocales(project, undefined)).toEqual(['de-DE', 'en-US']);
  });

  test('rejects fr-FR when the project uses only de-DE and en-US', () => {
    expect(() => selectExportLocales(project, ['fr-FR'])).toThrow(new ExportError('fr-FR is not a locale of this project'));
    // "all" next to an unsupported locale is rejected, not expanded (#30).
    expect(() => selectExportLocales(project, ['all', 'pt-BR'])).toThrow(new ExportError('pt-BR is not a supported locale'));
  });

  test('rejects an unsupported locale', () => {
    expect(() => selectExportLocales(project, 'pt-BR')).toThrow('pt-BR is not a supported locale');
  });

  test('rejects an export for a locale outside the saved project', async () => {
    const workspace = await workspaceFactory();
    await saveProject(workspace, projectInputFactory({ locales: ['de-DE', 'en-US'] }));
    await expect(createExport(workspace, { locales: 'fr-FR', measure })).rejects.toThrow('fr-FR is not a locale of this project');
  });
});
