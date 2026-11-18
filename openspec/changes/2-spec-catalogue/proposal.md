Issue: #2

# Proposal

## Why

Every generator in the tool (logo pack, screenshots, creative assets, video, export) needs the exact sizes,
formats and limits of the App Store, Google Play and the web, and every localized asset needs the 6 media
locales with their store codes. Without one typed source these values would be copied into each generator
and drift apart. This change creates that source first, because issues #3, #5–#9 and #11 depend on it.

## What Changes

- New spec catalogue: one typed entry per store asset (App Store screenshots incl. iPhone Duo outer and inner and
  iPad, app previews, product page header / search results / universal assets, in-app event media, app icon;
  Google Play icon, feature graphic, phone / tablet / Chromebook / Wear / TV / XR screenshots, TV banner, adaptive
  icon layers and densities; web favicons, manifest icons, Open Graph, X, WhatsApp, social profile and banner sizes).
- Every entry states target, asset kind, allowed dimensions (fixed sizes or a range with aspect ratio), formats,
  alpha rule, file size limit, count limits, required / optional, video limits where relevant, `verified` flag and
  source URL.
- New locale catalogue with `de-DE`, `en-US`, `es-ES`, `it-IT`, `fr-FR`, `tr-TR`: English and native display names,
  App Store Connect code, Google Play code, and a helper that resolves "one / several / all".
- New validator that checks the measured properties of a generated file against a spec entry and returns every
  problem at once; plus an inspector that measures an image file (dimensions, alpha, format, byte size).

Acceptance criteria from the issue:
- Spec entries for all assets in the research file.
- Every entry has `verified`, source URL, required / optional, alpha rule, format list and limits.
- Locale catalogue with display names, App Store Connect codes (`it`, `tr`) and Google Play codes.
- A validator checks a generated file (dimensions, alpha, format, file size) against its spec entry.
- Unit tests cover lookup, validation success and validation failure.

Targets: Apple App Store, Google Play, web / social. Locales: all 6.

## Not in this change

- Generating any asset (logo pack, screenshots, video) — later issues.
- Measuring video files (duration, fps, audio via ffprobe) — the validator accepts these properties, the video
  inspector comes with the preview pipeline (#20).
- UI or API endpoints exposing the catalogue — #3 and #4.

## Capabilities

### New Capabilities
- `media-specs`: catalogue of store and web media asset specifications, lookup and validation of generated files.
- `media-locales`: catalogue of the supported media locales, their store codes and locale selection.

### Modified Capabilities
- none

## Impact

- New code in `src/core/specs/` and `src/core/locales/`; unit tests in `tests/unit/`.
- New runtime dependency `sharp` (Apache-2.0) to inspect images; it is also needed by the renderers in later issues.
- No change to server, CLI or UI.
