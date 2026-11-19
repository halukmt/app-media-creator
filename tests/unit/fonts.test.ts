// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { cardFont, pathData } from '../../src/core/screenshots/fonts.js';

describe('pathData writes glyph outlines as SVG path data', () => {
  test('writes coordinates a hair off an integer as that integer, not NaN', () => {
    expect(
      pathData([
        { type: 'M', x: 412.03, y: 341.41 },
        { type: 'Q', x1: 459.17, y1: 305.46, x: 459.17, y: 314.00000000000006 },
        { type: 'C', x1: 1.5, y1: 2.001, x2: 3.999, y2: 4, x: 5, y: 6 },
        { type: 'Z' },
      ]),
    ).toBe('M412.03 341.41Q459.17 305.46 459.17 314C1.50 2 4 4 5 6Z');
  });

  test('writes 0 for a coordinate that is not a finite number', () => {
    expect(pathData([{ type: 'L', x: Number.NaN, y: Number.POSITIVE_INFINITY }])).toBe('L0 0');
  });

  test('draws text at many positions and sizes without NaN in the path', () => {
    const font = cardFont(800);
    for (let size = 20; size < 120; size += 0.37) {
      expect(font.path('Demo İşğ', 628 * 0.07 + 628 * 0.42, (628 * 0.12) / 3 + size, size).path).not.toMatch(/NaN|e[-+]/);
    }
  });
});
