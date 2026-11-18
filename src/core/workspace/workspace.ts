import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defaultProject, validateProject, type ProjectSettings, type ProjectValidation } from './project.js';

export const DEFAULT_WORKSPACE_DIR = '.app-media';
const PROJECT_FILE = 'project.json';
const FOLDERS = ['inputs', 'jobs', 'output', 'exports'] as const;
const MAX_NAME_LENGTH = 100;

export interface Workspace {
  /** Absolute path of the workspace folder. */
  root: string;
  inputsDir: string;
  jobsDir: string;
  outputDir: string;
  /** ZIP files created by the export. */
  exportsDir: string;
  projectFile: string;
}

/** `project.json` exists but cannot be used; `problems` lists every reason for the UI. */
export class ProjectFileError extends Error {
  constructor(
    readonly file: string,
    readonly problems: string[],
  ) {
    super(`${file} is invalid: ${problems.join('; ')}`);
  }
}

/** Default app name: the folder that contains the workspace, trimmed to a valid name. */
function defaultName(root: string): string {
  const name = path.basename(path.dirname(root)).trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || 'My app';
}

/**
 * Opens the workspace folder and creates `project.json`, `inputs/`, `jobs/`, `output/` and `exports/` when missing.
 * Existing content is never changed.
 */
export async function openWorkspace(dir: string): Promise<Workspace> {
  const root = path.resolve(dir);
  const workspace: Workspace = {
    root,
    inputsDir: path.join(root, 'inputs'),
    jobsDir: path.join(root, 'jobs'),
    outputDir: path.join(root, 'output'),
    exportsDir: path.join(root, 'exports'),
    projectFile: path.join(root, PROJECT_FILE),
  };
  for (const folder of FOLDERS) await mkdir(path.join(root, folder), { recursive: true });
  if (!existsSync(workspace.projectFile)) {
    await writeJsonAtomic(workspace.projectFile, defaultProject(defaultName(root)));
  }
  return workspace;
}

/** Reads and validates `project.json`. Throws ProjectFileError naming every problem. */
export async function readProject(workspace: Workspace): Promise<ProjectSettings> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(workspace.projectFile, 'utf8'));
  } catch {
    throw new ProjectFileError(workspace.projectFile, ['not valid JSON']);
  }
  const result = validateProject(raw);
  if (!result.ok) throw new ProjectFileError(workspace.projectFile, result.errors);
  return result.project;
}

// Saves run one after another, so overlapping requests never interleave their writes.
let saveQueue: Promise<unknown> = Promise.resolve();

/** Validates and saves settings. On invalid input nothing is written and the errors are returned. */
export function saveProject(workspace: Workspace, input: unknown): Promise<ProjectValidation> {
  const run = async (): Promise<ProjectValidation> => {
    const result = validateProject(input);
    if (result.ok) await writeJsonAtomic(workspace.projectFile, result.project);
    return result;
  };
  const next = saveQueue.then(run, run);
  saveQueue = next.catch(() => undefined);
  return next;
}

/** Writes JSON to a uniquely named temporary file and renames it, so readers never see a half-written file. */
async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}
