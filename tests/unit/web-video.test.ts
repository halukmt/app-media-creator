// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { parseSeconds, purposeAvailable, resultSpecs, trimFields, trimFrom, videoRequestBody } from '../../src/web/lib/video.js';

const MESSAGES = { invalid: 'invalid', order: 'order' };

describe('The Video section reads seconds and the trim from its fields', () => {
  test('reads empty as not set and accepts a dot or a comma as decimal mark', () => {
    expect(parseSeconds('')).toBeUndefined();
    expect(parseSeconds(' 2.5 ')).toBe(2.5);
    expect(parseSeconds('2,5')).toBe(2.5);
    expect(trimFrom({ start: '1', end: '' }, MESSAGES)).toEqual({ trim: { start: 1 }, errors: {} });
    expect(trimFields({ start: 3 })).toEqual({ start: '3', end: '' });
  });

  test('rejects text, negative numbers and an end before the start', () => {
    expect(parseSeconds('abc')).toBeNull();
    expect(parseSeconds('-1')).toBeNull();
    expect(trimFrom({ start: 'x', end: '' }, MESSAGES).errors).toEqual({ start: 'invalid' });
    expect(trimFrom({ start: '5', end: '4' }, MESSAGES).errors).toEqual({ end: 'order' });
    // Beyond what the settings store, and an end of 0 without a start.
    expect(parseSeconds('4000')).toBeNull();
    expect(trimFrom({ start: '', end: '0' }, MESSAGES).errors).toEqual({ end: 'order' });
  });
});

describe('A generate request carries only the texts of the requested languages', () => {
  const settings = {
    trim: { start: 1 },
    intro: { 'de-DE': 'Faire Teams', 'fr-FR': 'Équipes justes' },
    outro: {},
    cardSeconds: 2,
    formats: ['vertical'] as const,
    frame: 'iphone',
    texts: { 'tr-TR': 'Adil takımlar', 'fr-FR': 'Équipes' },
  };

  test('drops the saved text of a language removed from the project (#111)', () => {
    expect(videoRequestBody('store-preview', ['de-DE'], settings)).toEqual({ locales: ['de-DE'], trim: { start: 1 }, intro: { 'de-DE': 'Faire Teams' }, outro: {}, cardSeconds: 2 });
    expect(videoRequestBody('device-video', ['tr-TR'], settings)).toMatchObject({ texts: { 'tr-TR': 'Adil takımlar' }, formats: ['vertical'] });
  });

  test('sends no texts and no empty trim for a loop', () => {
    expect(videoRequestBody('loop', ['de-DE'], { ...settings, trim: {} })).toEqual({ locales: ['de-DE'] });
  });
});

describe('Video purposes depend on the stores of the project', () => {
  test('offers App Store purposes only with the App Store and device videos only with Web', () => {
    const apple = { apple: { enabled: true }, web: { enabled: false } };
    expect(purposeAvailable('store-preview', apple)).toBe(true);
    expect(purposeAvailable('loop', apple)).toBe(true);
    expect(purposeAvailable('device-video', apple)).toBe(false);
    expect(resultSpecs('loop')).toEqual(['apple.creative.header-video', 'apple.creative.search-video']);
  });
});
