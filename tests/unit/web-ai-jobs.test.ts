// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { headlineLocales, isWaiting, latestCopyJob } from '../../src/web/lib/ai-jobs.js';

const job = (id: string, status: string, locales: string[] = []) => ({
  id,
  task: 'copy',
  status,
  headlines: { locales: Object.fromEntries(locales.map((locale) => [locale, { slots: [{ input: 'x' }] }])) },
});

describe('The AI job helpers of the Screenshots section', () => {
  test('picks the newest copy job and lists its languages in project order', () => {
    const jobs = [job('20261119-120000-bbbb', 'ready', ['tr-TR', 'de-DE']), job('20261119-110000-aaaa', 'waiting')];
    expect(latestCopyJob(jobs)?.id).toBe('20261119-120000-bbbb');
    expect(headlineLocales(jobs[0]!, ['de-DE', 'en-US', 'tr-TR'])).toEqual(['de-DE', 'tr-TR']);
  });

  test('has no job and nothing to wait for without jobs', () => {
    expect(latestCopyJob([])).toBeNull();
    expect(isWaiting(null)).toBe(false);
    expect(isWaiting(job('20261119-110000-aaaa', 'waiting'))).toBe(true);
    expect(isWaiting(job('20261119-110000-aaaa', 'invalid'))).toBe(false);
  });
});
