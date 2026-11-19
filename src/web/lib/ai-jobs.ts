/** AI job helpers for the UI (pure, tested in Node). */

interface JobLike {
  id: string;
  task: string;
  status: string;
  headlines?: { locales: Partial<Record<string, { slots: { input: string }[] }>> };
}

/** The newest copy job (the server lists jobs newest first), or null. */
export function latestCopyJob<T extends JobLike>(jobs: readonly T[]): T | null {
  return jobs.find((job) => job.task === 'copy') ?? null;
}

/** Languages a job has headlines for, in the order of `order` (e.g. the project locales). */
export function headlineLocales(job: JobLike, order: readonly string[]): string[] {
  const present = Object.keys(job.headlines?.locales ?? {});
  return order.filter((locale) => present.includes(locale));
}

/** A job still waits for results: the panel listens for changes and shows the command. */
export function isWaiting(job: JobLike | null): boolean {
  return job?.status === 'waiting';
}
