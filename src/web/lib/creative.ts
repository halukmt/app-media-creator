/** App Store header, search and universal images in the Screenshots section (pure helpers, tested in Node). */

/** UI label key per creative spec; sizes, safe areas and the phrase limit come from the catalogue API. */
export const CREATIVE_LABELS = {
  'apple.creative.header-image': 'header',
  'apple.creative.search-image': 'search',
  'apple.creative.universal-image': 'universal',
} as const satisfies Record<string, string>;

export type CreativeAssetKey = (typeof CREATIVE_LABELS)[keyof typeof CREATIVE_LABELS];

export function creativeLabelKey(specId: string): CreativeAssetKey | undefined {
  return (CREATIVE_LABELS as Record<string, CreativeAssetKey>)[specId];
}

/** Width of the preview renders in pixels: wide enough for the phrase to be readable in a 3-column grid. */
export const CREATIVE_PREVIEW_WIDTH = 640;

type Box = { x: number; y: number; width: number; height: number };

/**
 * A safe area given as shares of the image (0 to 1) in percent, rounded to two decimals, for the preview guide. The
 * box is clamped to the image, so the guide never reaches past the picture.
 */
export function safeAreaPercent(area: Box): Box {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  const x = clamp(area.x);
  const y = clamp(area.y);
  const percent = (share: number) => Math.round(share * 10000) / 100;
  return { x: percent(x), y: percent(y), width: percent(Math.min(clamp(area.width), 1 - x)), height: percent(Math.min(clamp(area.height), 1 - y)) };
}

/** A safe area in pixels as shares of its image size. */
export function safeAreaShares(size: { width: number; height: number }, area: Box): Box {
  return { x: area.x / size.width, y: area.y / size.height, width: area.width / size.width, height: area.height / size.height };
}
