// conventions: RULE-TESTING-3301
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { cardFont, pathData } from '../../src/core/screenshots/fonts.js';

/** X card layout (1200 × 628): text starts right of the logo; the size range covers the fitted title sizes. */
const X_CARD = { width: 1200, height: 628 };
const TEXT_X = X_CARD.width * 0.07 + X_CARD.height * 0.42 + X_CARD.width * 0.05;

describe('pathData writes glyph outlines as SVG path data', () => {
  test('writes coordinates in their shortest form, a hair off an integer as that integer', () => {
    expect(
      pathData([
        { type: 'M', x: 412.03, y: 341.41 },
        { type: 'Q', x1: 459.17, y1: 305.46, x: 459.17, y: 314.00000000000006 },
        { type: 'C', x1: 1.5, y1: 2.001, x2: 3.999, y2: -0.001, x: 5, y: 6 },
        { type: 'Z' },
      ]),
    ).toBe('M412.03 341.41Q459.17 305.46 459.17 314C1.5 2 4 0 5 6Z');
  });

  test('rejects a coordinate that is not a finite number instead of drawing to the origin', () => {
    expect(() => pathData([{ type: 'L', x: Number.NaN, y: 1 }])).toThrow(/Invalid text coordinate/);
    expect(() => pathData([{ type: 'L', x: 1, y: Number.POSITIVE_INFINITY }])).toThrow(/Invalid text coordinate/);
  });

  test('draws text at many positions and sizes without NaN in the path', () => {
    const font = cardFont(800);
    for (let size = 20; size < 120; size += 0.37) {
      expect(font.path('Demo İşğ', TEXT_X, X_CARD.height * 0.12 + size, size).path).not.toMatch(/NaN|e[-+]/);
    }
  });

  test('is the only place that turns opentype paths into SVG (toPathData / toSVG lose coordinates)', () => {
    const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));
    const offenders = files.filter((f) => /\.(toPathData|toSVG)\(/.test(readFileSync(path.join('src', f), 'utf8')));
    expect(offenders).toEqual([]);
  });
});
