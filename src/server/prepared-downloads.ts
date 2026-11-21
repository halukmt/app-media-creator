import { randomBytes } from 'node:crypto';
import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';

/** How long a prepared download waits for the browser to fetch it (and for retries of that fetch). */
export const DOWNLOAD_TTL = 10 * 60_000;

export interface PreparedDownloadOptions {
  /** Parent of the waiting folders; each server run builds into its own subfolder. */
  pendingRoot: string;
  /** Where a fetched ZIP goes, next to the other exports. */
  doneDir: string;
  ttl?: number;
  now?: () => number;
  /** Starts the expiry timer; injectable for tests. The default timer does not keep the process alive. */
  setTimer?: (run: () => Promise<void>, ms: number) => void;
}

interface Entry {
  file: string;
  fileName: string;
  expires: number;
  /** The move out of the waiting folder, shared by fetches that arrive at the same time; cleared when it fails. */
  moving?: Promise<string>;
  /** Set once the move worked: from then on the ZIP is an export like any other and expiry leaves it. */
  fetched: boolean;
}

/**
 * Prepared downloads of the Export section (#47, #116). A random token (192 bits) per built ZIP is the only way to fetch
 * it and stays valid for the TTL, so a download manager can retry. Prepared ZIPs wait in a folder of this server run:
 * the first fetch moves the ZIP to the exports folder like every other export; when the TTL ends, the token is dropped
 * on its own timer and a ZIP never fetched is removed. `cleanUp()` removes the waiting folders of earlier runs once they
 * are older than the TTL (their tokens are gone with them); folders of runs still alive are fresh and stay.
 */
export function preparedDownloads(options: PreparedDownloadOptions) {
  const ttl = options.ttl ?? DOWNLOAD_TTL;
  const now = options.now ?? Date.now;
  const setTimer =
    options.setTimer ??
    ((run: () => Promise<void>, ms: number) => {
      setTimeout(() => void run(), ms).unref();
    });
  const runDir = path.join(options.pendingRoot, `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`);
  const pending = new Map<string, Entry>();

  /** Drops the token; removes the ZIP when it was never fetched (after a move in flight has settled, #120). */
  const drop = async (token: string) => {
    const entry = pending.get(token);
    if (!entry) return;
    pending.delete(token);
    if (entry.moving) await entry.moving.catch(() => undefined);
    if (!entry.fetched) await rm(entry.file, { force: true }).catch(() => undefined);
  };

  const cleanFolder = async (folder: string): Promise<void> => {
    if (folder === runDir) return;
    const info = await stat(folder).catch(() => undefined);
    if (!info) return;
    const age = now() - info.mtimeMs;
    if (age > ttl) await rm(folder, { force: true, recursive: true }).catch(() => undefined);
    else setTimer(() => cleanFolder(folder), ttl - age + 1000);
  };

  return {
    /** The waiting folder of this run, created on first use. */
    async folder(): Promise<string> {
      await mkdir(runDir, { recursive: true });
      return runDir;
    },

    issue(file: string, fileName: string): string {
      const token = randomBytes(24).toString('hex');
      pending.set(token, { file, fileName, expires: now() + ttl, fetched: false });
      // The timer alone ends the token: no later request needed, and a clock change cannot keep it alive.
      setTimer(() => drop(token), ttl);
      return token;
    },

    /** The ZIP of a valid token; the first fetch moves it out of the waiting folder (later and parallel ones wait for it). */
    async take(token: string): Promise<{ file: string; fileName: string } | undefined> {
      const entry = pending.get(token);
      if (!entry) return undefined;
      if (entry.expires <= now()) {
        await drop(token);
        return undefined;
      }
      if (entry.fetched) return { file: entry.file, fileName: entry.fileName };
      entry.moving ??= (async () => {
        const target = path.join(options.doneDir, path.basename(entry.file));
        await mkdir(options.doneDir, { recursive: true });
        await rename(entry.file, target);
        entry.file = target;
        entry.fetched = true;
        return target;
      })().finally(() => {
        // A failed move (e.g. a file locked by antivirus) can be retried by the next fetch (#118).
        entry.moving = undefined;
      });
      return { file: await entry.moving, fileName: entry.fileName };
    },

    /**
     * Removes the waiting folders earlier runs left once they are older than the TTL. A younger one may belong to
     * another live instance: it is checked again when it reaches that age (a quick restart, #118).
     */
    async cleanUp(): Promise<void> {
      const names = await readdir(options.pendingRoot).catch(() => [] as string[]);
      await Promise.all(names.map((name) => cleanFolder(path.join(options.pendingRoot, name))));
    },
  };
}

export type PreparedDownloads = ReturnType<typeof preparedDownloads>;
