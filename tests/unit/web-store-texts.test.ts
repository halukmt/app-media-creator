// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { STORE_TEXT_SPECS, storeTextLength } from '../../src/core/specs/index.js';
import { isOverLimit, storeGroups, textLength, withText } from '../../src/web/lib/store-texts.js';

describe('The Store texts helpers count like the server', () => {
  test('count characters and UTF-8 bytes after trimming, for German and Turkish', () => {
    for (const text of ['  Fußball, Mannschaft  ', 'futbol,takım,halı saha', 'Teams ⚽']) {
      for (const spec of STORE_TEXT_SPECS) expect(textLength(spec, text)).toBe(storeTextLength(spec, text));
    }
    const keywords = STORE_TEXT_SPECS.find((spec) => spec.field === 'apple-keywords')!;
    expect(isOverLimit(keywords, 'ş'.repeat(50))).toBe(false);
    expect(isOverLimit(keywords, 'ş'.repeat(51))).toBe(true);
  });

  test('show only the enabled stores, App Store first, fields in paste order', () => {
    expect(storeGroups(STORE_TEXT_SPECS, { apple: true, google: true }).map((group) => [group.target, group.fields.length])).toEqual([
      ['apple', 6],
      ['google', 3],
    ]);
    expect(storeGroups(STORE_TEXT_SPECS, { apple: false, google: true }).map((group) => group.target)).toEqual(['google']);
    expect(storeGroups(STORE_TEXT_SPECS, { apple: false, google: false })).toEqual([]);
  });
});

describe('Editing store texts changes one field without touching the others', () => {
  test('sets and removes a field, drops an empty language, and never mutates the input', () => {
    const texts = { 'de-DE': { 'apple-name': 'Teamfinder' } };
    const added = withText(texts, 'tr-TR', 'apple-name', 'Takım');
    expect(added).toEqual({ 'de-DE': { 'apple-name': 'Teamfinder' }, 'tr-TR': { 'apple-name': 'Takım' } });
    expect(withText(added, 'de-DE', 'apple-name', '')).toEqual({ 'tr-TR': { 'apple-name': 'Takım' } });
    expect(texts).toEqual({ 'de-DE': { 'apple-name': 'Teamfinder' } });
  });
});
