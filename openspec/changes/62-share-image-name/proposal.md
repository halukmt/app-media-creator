Issue: #62

# Proposal

## Why

Share images without a tagline and wide banners showed only a clipped fragment of the app name's first letter. Cause:
opentype.js 2.0 `toPathData` rounds coordinates by appending `"e+2"` to the decimal part as a string; for a coordinate
a hair off an integer (e.g. 314.00000000000006) the decimal part is written in exponent notation and the result is
`NaN`. librsvg stops drawing the path at that command. Whether it happens depends on the exact position and size, so it
hit some images and not others (and the cached `NaN` made it sticky within a run).

## What Changes

- Glyph outlines are written as SVG path data by our own `pathData` (2 decimals, never `NaN` or exponent notation)
  instead of opentype's `toPathData`. Affects every text drawn as paths: screenshot cards, share images, banners,
  email signature.
- Regression tests: the whole name on the X card (tr-TR, no tagline), Open Graph (de-DE), Facebook cover and LinkedIn
  banner; `pathData` formatting; no `NaN` in text paths across many sizes.

Acceptance criteria from the issue:
- The full app name is drawn on every share image and banner with and without a tagline.
- Unit test for `de-DE` and `tr-TR` that checks the ink width of the name.
- A pixel check that fails with the current behaviour (verified: ink width 43 px before, full width after).

Targets: web / social (and screenshot cards). Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `share-images`: text is always drawn completely.

## Impact

- `src/core/screenshots/fonts.ts`; tests `tests/unit/fonts.test.ts`, `tests/unit/share-images.test.ts`.
- Golden card images unchanged (same 2-decimal coordinates).
