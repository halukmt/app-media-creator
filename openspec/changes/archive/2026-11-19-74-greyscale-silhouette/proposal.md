Issue: #74

# Proposal

## Why

Codex found this on #73: `analyseBackground` (added in #63) reads its analysis raster as RGBA. If sharp returns a
greyscale raster (grey + alpha) for a greyscale logo, border, corner and mark checks read the wrong bytes and the
silhouette becomes a filled box. `logoPalette` already converts to sRGB for this reason.

With the bundled sharp 0.35.5 the raw output of 8-bit and 16-bit greyscale PNGs and greyscale JPEGs already has four
channels, so the failure could not be reproduced; the conversion makes the analysis independent of that default.

## What Changes

- New shared helper `readRgba(pipeline)`: sRGB, alpha, 8-bit, 4 bytes per pixel, checked by buffer length. Every pixel
  loop over logo rasters uses it: `logoPalette`, `analyseBackground` and the cut in `renderSilhouette`.
- Tests: `readRgba` on a one-channel and a 16-bit greyscale PNG; the monochrome layer of a greyscale logo on white.

Acceptance criteria from the issue:
- The analysis raster is converted to sRGB before reading pixels.
- Regression test with a greyscale logo on white: the mark is opaque, the background transparent.

Targets: Google Play (monochrome layer), Web (logo variants), icon variants. Locales: shared (no text).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `android-icons`: greyscale logos are cut out like colour logos.

## Impact

- `src/core/generators/render.ts`; tests in `tests/unit/android-icons.test.ts` and `tests/unit/app-store-icons.test.ts`,
  factory in `tests/factories/logos.ts`. CHANGELOG under Changed (hardening, no observed failure).
