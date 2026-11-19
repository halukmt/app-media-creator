// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { headlineLocales, isWaiting, resultLocales, storeTextLocales } from '../../src/web/lib/ai-jobs.js';

const job = (status: string, locales: string[] = []) => ({
  status,
  headlines: { locales: Object.fromEntries(locales.map((locale) => [locale, { slots: [{ input: 'x' }] }])) },
  storeTexts: Object.fromEntries(locales.map((locale) => [locale, { 'apple-name': 'Teamfinder' }])),
});

describe('The AI job helpers list the languages of a result', () => {
  test('lists the languages of headlines and store texts in project order', () => {
    const ready = job('ready', ['tr-TR', 'de-DE']);
    expect(headlineLocales(ready, ['de-DE', 'en-US', 'tr-TR'])).toEqual(['de-DE', 'tr-TR']);
    expect(storeTextLocales(ready, ['tr-TR', 'de-DE'])).toEqual(['tr-TR', 'de-DE']);
  });

  test('has no languages without a result and nothing to wait for without a job', () => {
    expect(resultLocales(undefined, ['de-DE'])).toEqual([]);
    expect(storeTextLocales({ status: 'waiting' }, ['de-DE'])).toEqual([]);
    expect(isWaiting(null)).toBe(false);
    expect(isWaiting(job('waiting'))).toBe(true);
    expect(isWaiting(job('invalid'))).toBe(false);
  });
});
