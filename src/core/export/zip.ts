import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { Zip, ZipPassThrough, strToU8 } from 'fflate';
import { selectProjectLocales, type LocaleId, type LocaleSelection } from '../locales/index.js';
import { getSpec } from '../specs/index.js';
import { safeBaseName } from '../workspace/inputs.js';
import type { ProjectSettings } from '../workspace/project.js';
import { StoreTextsFileError, defaultStoreTexts, readStoreTexts, type StoreTexts } from '../workspace/store-texts.js';
import { readProject, type Workspace } from '../workspace/workspace.js';
import { buildChecklist, checklistMarkdown, type Checklist, type LocateFile, type MeasureFile } from './checklist.js';
import { locateOutputFile, readManifest } from './manifest.js';
import { storeTextFiles } from './store-texts.js';

/** Invalid export request (e.g. a locale the project does not use). */
export class ExportError extends Error {}

/**
 * Resolves one, several or all locales and checks them against the project's locales.
 * No selection or "all" means all locales of the project; an empty list is rejected.
 * Throws ExportError naming every locale outside the project.
 */
export function selectExportLocales(project: ProjectSettings, selection: LocaleSelection | undefined): LocaleId[] {
  try {
    return selectProjectLocales(project.locales, selection);
  } catch (error) {
    throw new ExportError((error as Error).message);
  }
}

export interface ExportOptions {
  locales?: LocaleSelection;
  measure?: MeasureFile;
  locate?: LocateFile;
  /** Clock for the file name; injectable for tests. */
  now?: Date;
}

export interface ExportResult {
  /** Absolute path of the ZIP in the workspace `exports/` folder. */
  file: string;
  fileName: string;
  checklist: Checklist;
  /** Paths inside the ZIP, in order. */
  entries: string[];
}

async function prepare(workspace: Workspace, options: ExportOptions) {
  const project = await readProject(workspace);
  const locales = selectExportLocales(project, options.locales);
  const manifest = await readManifest(workspace);
  let storeTexts: StoreTexts;
  let storeTextsProblem: string | undefined;
  try {
    storeTexts = await readStoreTexts(workspace);
  } catch (error) {
    if (!(error instanceof StoreTextsFileError)) throw error;
    storeTexts = defaultStoreTexts();
    storeTextsProblem = `${error.message}; the store texts are not exported`;
  }
  const checklist = await buildChecklist({
    project,
    manifest,
    locales,
    storeTexts,
    outputDir: workspace.outputDir,
    ...(options.measure ? { measure: options.measure } : {}),
    ...(options.locate ? { locate: options.locate } : {}),
  });
  if (storeTextsProblem) {
    checklist.problems.push(storeTextsProblem);
    checklist.status = 'error';
  }
  return { project, locales, manifest, checklist, storeTexts };
}

/** Builds the checklist for the selected locales. */
export async function exportChecklist(workspace: Workspace, options: ExportOptions = {}): Promise<Checklist> {
  return (await prepare(workspace, options)).checklist;
}

/**
 * Writes a ZIP with the files of the selected locales and all shared files of the enabled targets, the store texts
 * of the selected locales (`<target>/store-texts/<store code>/NN-<field>.txt`), plus CHECKLIST.md, into the workspace `exports/` folder. Files are streamed and stored without compression.
 * A failed export leaves no partial ZIP behind.
 */
export async function createExport(workspace: Workspace, options: ExportOptions = {}): Promise<ExportResult> {
  const { project, locales, manifest, checklist, storeTexts } = await prepare(workspace, options);

  const allLocales = locales.length === project.locales.length;
  const stamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Random suffix: two exports in the same second never write to the same file.
  const fileName = `${safeBaseName(project.name)}-${allLocales ? 'all' : locales.join('_')}-${stamp}-${randomBytes(2).toString('hex')}.zip`;
  const file = path.join(workspace.exportsDir, fileName);

  const selected = manifest.entries.filter(
    (entry) =>
      project.targets[getSpec(entry.specId).target].enabled &&
      (entry.locale === undefined || locales.includes(entry.locale)) &&
      // Icon variants of an environment that was removed from the project are left out.
      (entry.environment === undefined || project.environments.some((e) => e.id === entry.environment)),
  );

  const out = createWriteStream(file);
  // Record a stream failure the moment it happens; the loop below checks it after every awaited step.
  let streamError: Error | undefined;
  out.on('error', (error) => {
    streamError ??= error;
  });
  const finished = once(out, 'finish');
  // Handled by the final await; this keeps an early failure from becoming an unhandled rejection.
  finished.catch(() => undefined);
  const entries: string[] = [];
  try {
    const failIfBroken = () => {
      if (streamError) throw streamError;
    };
    const zip = new Zip((error, chunk, final) => {
      if (error) {
        out.destroy(error);
        return;
      }
      if (streamError) return;
      out.write(chunk);
      if (final) out.end();
    });
    const drain = async () => {
      failIfBroken();
      if (out.writableNeedDrain) await once(out, 'drain');
    };

    const checklistPart = new ZipPassThrough('CHECKLIST.md');
    zip.add(checklistPart);
    checklistPart.push(strToU8(checklistMarkdown(checklist, project.name)), true);
    entries.push('CHECKLIST.md');

    for (const entry of selected) {
      const source = path.join(workspace.outputDir, entry.path);
      // Missing files are reported in the checklist; skip them (and links) before a ZIP entry is opened.
      if ((await locateOutputFile(source, workspace.outputDir)) !== 'own') continue;
      failIfBroken();
      const part = new ZipPassThrough(entry.path);
      zip.add(part);
      for await (const chunk of createReadStream(source)) {
        part.push(chunk as Uint8Array);
        await drain();
      }
      part.push(new Uint8Array(0), true);
      entries.push(entry.path);
    }
    // Store texts come from the document, not from generated files: always the current texts.
    for (const text of storeTextFiles(project, storeTexts, locales)) {
      failIfBroken();
      const part = new ZipPassThrough(text.path);
      zip.add(part);
      part.push(strToU8(text.text), true);
      entries.push(text.path);
      await drain();
    }
    failIfBroken();
    zip.end();
    await finished;
  } catch (error) {
    out.destroy();
    await rm(file, { force: true });
    throw error;
  }

  return { file, fileName, checklist, entries };
}
