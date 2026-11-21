import { watch, type FSWatcher } from 'node:fs';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { JOB_ID, JobError, applyJob, createJob, isJobTask, listJobs, promoOptionErrors, readJob, type CreateJobOptions, type PromoOptions } from '../core/jobs/index.js';
import { ProjectFileError, StoreTextsFileError, type Workspace } from '../core/workspace/index.js';
import { readOptionalJsonObject } from './json-body.js';

/** Changes within this time are reported once: an AI writes a result in several steps. */
const DEBOUNCE_MS = 250;
/** Comment line that keeps idle event streams open through proxies and browsers. */
const KEEPALIVE_MS = 25_000;

/**
 * Watches the jobs folder and calls `onChange` with the id of a job whose files changed (debounced per job). Other
 * names in the folder are ignored. Returns a function that stops watching.
 */
export function watchJobs(jobsDir: string, onChange: (id: string) => void): () => void {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let watcher: FSWatcher;
  try {
    watcher = watch(jobsDir, { recursive: true }, (_event, filename) => {
      const id = filename?.toString().split(/[\\/]/)[0];
      if (!id || !JOB_ID.test(id)) return;
      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          onChange(id);
        }, DEBOUNCE_MS),
      );
    });
  } catch {
    return () => undefined;
  }
  // A watcher error (the folder was removed or renamed) ends the watch instead of crashing the server.
  watcher.on('error', () => watcher.close());
  return () => {
    for (const timer of timers.values()) clearTimeout(timer);
    watcher.close();
  };
}

function jobError(c: Context, error: unknown) {
  if (error instanceof JobError) return c.json({ error: error.message }, error.status);
  if (error instanceof ProjectFileError) return c.json({ error: 'project.json in the workspace is invalid', problems: error.problems }, 500);
  if (error instanceof StoreTextsFileError) return c.json({ error: error.message, problems: error.problems }, 500);
  throw error;
}

/** AI job folders: create, list, read, apply, and a live event stream of changes. Mounted under /api. */
export function jobsRoutes(workspace: Workspace): Hono {
  const api = new Hono();
  // One folder watcher for all open event streams; it runs only while somebody listens.
  const listeners = new Set<(id: string) => void>();
  let stop: (() => void) | null = null;
  const subscribe = (listener: (id: string) => void) => {
    listeners.add(listener);
    stop ??= watchJobs(workspace.jobsDir, (id) => {
      for (const notify of listeners) notify(id);
    });
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && stop) {
        stop();
        stop = null;
      }
    };
  };

  // ?task=copy&limit=1 for the newest job of one section; without them all jobs.
  api.get('/jobs', async (c) => {
    const limit = Number(c.req.query('limit'));
    const task = c.req.query('task');
    if (task !== undefined && !isJobTask(task)) return c.json({ error: 'task must be copy, store-texts or promo-video' }, 400);
    return c.json(await listJobs(workspace, Number.isInteger(limit) && limit > 0 ? limit : Infinity, task));
  });

  api.post('/jobs', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    const { locales, task, promo } = parsed.body;
    if (task !== undefined && !isJobTask(task)) return c.json({ error: 'task must be copy, store-texts or promo-video' }, 400);
    if (locales !== undefined && typeof locales !== 'string' && !(Array.isArray(locales) && locales.every((l) => typeof l === 'string'))) {
      return c.json({ error: 'locales must be "all", a locale id or a list of locale ids' }, 400);
    }
    const promoErrors = promoOptionErrors(promo);
    if (promoErrors.length > 0) return c.json({ error: promoErrors.join('; ') }, 400);
    if (promo !== undefined && task !== 'promo-video') return c.json({ error: 'promo is only for promo-video jobs' }, 400);
    try {
      const options: CreateJobOptions = {
        ...(task !== undefined ? { task } : {}),
        ...(locales !== undefined ? { locales: locales as CreateJobOptions['locales'] } : {}),
        ...(promo !== undefined ? { promo: promo as PromoOptions } : {}),
      };
      return c.json(await createJob(workspace, options), 201);
    } catch (error) {
      return jobError(c, error);
    }
  });

  // Server-sent events: `job` with the id of a job whose files changed. Registered before /jobs/:id.
  api.get('/jobs/events', (c) =>
    streamSSE(c, async (stream) => {
      const unsubscribe = subscribe((id) => void stream.writeSSE({ event: 'job', data: id }).catch(() => undefined));
      const keepalive = setInterval(() => void stream.write(': keepalive\n\n').catch(() => undefined), KEEPALIVE_MS);
      await new Promise<void>((resolve) => stream.onAbort(resolve));
      clearInterval(keepalive);
      unsubscribe();
    }),
  );

  api.get('/jobs/:id', async (c) => {
    try {
      return c.json(await readJob(workspace, c.req.param('id')));
    } catch (error) {
      return jobError(c, error);
    }
  });

  api.post('/jobs/:id/apply', async (c) => {
    const parsed = await readOptionalJsonObject(c);
    if (!parsed.ok) return c.json({ error: parsed.error }, 400);
    try {
      // Store text jobs apply as a whole; headline jobs apply one variant.
      return c.json(await applyJob(workspace, c.req.param('id'), parsed.body.variant));
    } catch (error) {
      return jobError(c, error);
    }
  });

  return api;
}
