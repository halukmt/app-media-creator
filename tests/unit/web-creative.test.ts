// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { MAX_PHRASE } from '../../src/core/workspace/index.js';
import { buildCatalogue } from '../../src/server/catalogue-routes.js';
import { creativeLabelKey, safeAreaPercent, safeAreaShares } from '../../src/web/lib/creative.js';

describe('The header image helpers of the Screenshots section', () => {
  test('turns the header safe area from the catalogue into percent with two decimals', () => {
    const header = buildCatalogue().creativeImages.find((image) => image.specId === 'apple.creative.header-image')!;
    expect(safeAreaPercent(safeAreaShares(header.size, header.safeArea))).toEqual({ x: 28.57, y: 29.95, width: 42.86, height: 40.16 });
  });

  test('keeps the guide inside the image when the shares reach past it', () => {
    expect(safeAreaPercent({ x: 0.6, y: -0.2, width: 0.6, height: 2 })).toEqual({ x: 60, y: 0, width: 40, height: 100 });
  });

  test('has a label for every creative image the catalogue lists, and serves the phrase limit of core', () => {
    const catalogue = buildCatalogue();
    expect(catalogue.creativeImages.map((image) => creativeLabelKey(image.specId))).toEqual(['header', 'search', 'universal']);
    expect(catalogue.maxPhrase).toBe(MAX_PHRASE);
    expect(creativeLabelKey('apple.icon')).toBeUndefined();
  });
});
