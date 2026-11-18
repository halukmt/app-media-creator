Issue: #7

# Proposal

## Why

Android apps need a 512×512 Play Store icon and launcher icons inside the app: adaptive icon layers (background,
foreground, monochrome for themed icons) in five densities plus legacy icons for old devices. Developers copy these
into `app/src/main/res/`, so the output must follow the Android resource folder layout.

## What Changes

- An Android icon generator that takes the newest uploaded logo and writes:
  - `google/shared/icon/play-icon.png` — 512×512 32-bit PNG, full square, logo on the background colour.
  - `google/shared/android-res/mipmap-<density>/ic_launcher_background.png`, `ic_launcher_foreground.png`,
    `ic_launcher_monochrome.png` (108 dp per density, logo inside the 66 dp safe zone) and `ic_launcher.png`
    (legacy 48 dp per density), for mdpi, hdpi, xhdpi, xxhdpi and xxxhdpi.
  - `google/shared/android-res/mipmap-anydpi-v26/ic_launcher.xml` referencing the three layers.
- Output layout: generated files may sit in one subfolder below their asset folder (for Android density folders).
- Catalogue: the adaptive layers, legacy launcher icons and the new `ic_launcher.xml` document share the
  `android-res` folder; `xml` becomes a document format.
- API: `POST /api/generate/android-icons` with optional background colour and logo scale of the Play icon.
- Also fixes the Codex finding on PR #40: the full decode check of an SVG logo runs at a bounded resolution.

Acceptance criteria from the issue:
- Play icon 512×512 32-bit PNG ≤ 1024 KB, full square without rounding or shadow.
- Adaptive icon layers (foreground, background, monochrome) at 108 dp with the 66 dp safe zone, all mipmap densities,
  `ic_launcher.xml`.
- Legacy launcher icons 48 dp per density.
- Spec validation and tests.

Targets: Google Play. Locales: not language-specific (shared by all locales).

## Not in this change

- Expo / React Native icon configuration (1024 px source images and `app.json` snippet) — follow-up issue.
- Round legacy icons (`ic_launcher_round`), Android TV and Wear OS icons. UI (#10).

## Capabilities

### New Capabilities
- `android-icons`: Google Play icon and Android launcher icons from the logo.

### Modified Capabilities
- `export`: generated files may be placed in one subfolder below their asset folder.
- `media-specs`: Android launcher resources share one folder and include `ic_launcher.xml`.

## Impact

- New `src/core/generators/android-icons.ts`; `src/core/export/manifest.ts` (subfolder); `src/core/specs/google.ts`,
  `types.ts`; `src/core/generators/render.ts` (bounded SVG decode, silhouette rendering); new route.
