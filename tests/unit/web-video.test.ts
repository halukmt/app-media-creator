// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { parseSeconds, purposeAvailable, resultSpecs, trimFields, trimFrom } from '../../src/web/lib/video.js';

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

describe('Video purposes depend on the stores of the project', () => {
  test('offers App Store purposes only with the App Store and device videos only with Web', () => {
    const apple = { apple: { enabled: true }, web: { enabled: false } };
    expect(purposeAvailable('store-preview', apple)).toBe(true);
    expect(purposeAvailable('loop', apple)).toBe(true);
    expect(purposeAvailable('device-video', apple)).toBe(false);
    expect(resultSpecs('loop')).toEqual(['apple.creative.header-video', 'apple.creative.search-video']);
  });
});
