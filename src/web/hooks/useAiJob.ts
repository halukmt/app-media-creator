import { useCallback, useEffect, useRef, useState } from 'react';
import { JOB_EVENTS_URL, fetchJob, fetchJobs, type AiJob, type AiJobTask } from '../api';

export interface AiJobFollow {
  /** The newest job of the task, or null when there is none (or it could not be loaded). */
  job: AiJob | null;
  /** Shows a job at once (a newly created one, or an optimistic "applied" state); later fetches of older requests are dropped. */
  showJob: (job: AiJob | null) => void;
  /** Fetches a job again; the answer is kept only if nothing changed the shown job since it was asked for. */
  refreshJob: (id: string) => void;
}

/**
 * Follows the newest AI job of a task: loads it once, then listens to the server's event stream for changes in its
 * folder. It keeps following after an invalid or applied result, because the AI may write again into the same folder;
 * a result written while the page was closed comes with the first load.
 */
export function useAiJob(task: AiJobTask): AiJobFollow {
  const [job, setJob] = useState<AiJob | null>(null);
  // Every change of the shown job counts; a fetched job is kept only if nothing changed the panel since it was asked
  // for (a newer job, an optimistic "applied", or a newer fetch).
  const version = useRef(0);
  const showJob = useCallback((next: AiJob | null) => {
    version.current += 1;
    setJob(next);
  }, []);
  const refreshJob = useCallback((id: string) => {
    const asked = (version.current += 1);
    void fetchJob(id)
      .then((fetched) => {
        if (asked === version.current) setJob(fetched);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // A job shown meanwhile (e.g. one just prepared) is newer than this list: a late answer must not replace it.
    const asked = version.current;
    const showIfCurrent = (next: AiJob | null) => {
      if (asked === version.current) showJob(next);
    };
    fetchJobs(task, 1)
      .then((jobs) => showIfCurrent(jobs[0] ?? null))
      .catch(() => showIfCurrent(null));
  }, [task, showJob]);

  const jobId = job?.id;
  useEffect(() => {
    if (!jobId) return undefined;
    const events = new EventSource(JOB_EVENTS_URL);
    const refresh = () => refreshJob(jobId);
    events.addEventListener('job', (event) => {
      if ((event as MessageEvent<string>).data === jobId) refresh();
    });
    // After a dropped connection the browser reconnects; changes in between are fetched once.
    events.addEventListener('open', refresh);
    return () => events.close();
  }, [jobId, refreshJob]);

  return { job, showJob, refreshJob };
}
