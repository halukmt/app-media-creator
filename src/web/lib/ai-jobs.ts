/** AI job helpers for the UI (pure, tested in Node). */

interface JobLike {
  status: string;
  headlines?: { locales: Partial<Record<string, unknown>> };
  storeTexts?: Partial<Record<string, unknown>>;
}

/** The languages a result has entries for, in the order of `order` (e.g. the project locales). */
export function resultLocales(result: Partial<Record<string, unknown>> | undefined, order: readonly string[]): string[] {
  const present = Object.keys(result ?? {});
  return order.filter((locale) => present.includes(locale));
}

/** Languages a job has headlines for, in the order of `order`. */
export function headlineLocales(job: JobLike, order: readonly string[]): string[] {
  return resultLocales(job.headlines?.locales, order);
}

/** Languages a job has store texts for, in the order of `order`. */
export function storeTextLocales(job: JobLike, order: readonly string[]): string[] {
  return resultLocales(job.storeTexts, order);
}

/** A job still waits for results: the panel listens for changes and shows the command. */
export function isWaiting(job: JobLike | null): boolean {
  return job?.status === 'waiting';
}
