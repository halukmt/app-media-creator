Issue: #6

# Proposal

## Why

Every iOS app needs a 1024×1024 App Store icon, and since iOS 18 also dark and tinted appearances in its asset
catalog. Apple's Icon Composer builds layered (Liquid Glass) icons from separate background and foreground layers.
Users should get all of this from their logo in one step, with the logo kept inside the area that stays visible after
the system rounds the corners.

## What Changes

- An App Store icon generator that takes the newest uploaded logo and writes into `apple/shared/`:
  `icon/app-icon.png` (1024, opaque), `icon/app-icon-dark.png` and `icon/app-icon-tinted.png` (1024, transparent
  background, the tinted one in grey tones), and `icon-composer/background.png` and `icon-composer/foreground.png`
  (1024, full bleed, not pre-masked).
- The logo is fitted into a centred box of 40–80 % of the canvas (default 70 %); 80 % is a chosen safe limit that keeps
  a margin to the rounded mask (the geometric limit is about 87 %).
- Background colour: a given colour, white by default; a palette endpoint offers the logo's main colours as
  suggestions for the UI (#10).
- Spec catalogue: entries for the dark and tinted appearances and for the two Icon Composer layers.
- API: `POST /api/generate/app-store-icons`, `GET /api/logo/palette`.

Acceptance criteria from the issue:
- App Store icon 1024×1024 PNG, opaque, square, unmasked; background colour from the logo palette or a preset.
- Dark and tinted variants; layer-ready files (background + foreground) for Icon Composer.
- Logo safe area keeps the mark inside the visible area after masking.
- Every file passes spec validation; tests with SVG and PNG input.

Targets: Apple App Store. Locales: not language-specific (shared by all locales).

## Not in this change

- The `.icon` file of Icon Composer itself (macOS only, format not documented) and legacy `AppIcon.appiconset` sizes.
- watchOS, visionOS and tvOS icons. Preview / production variants (#34). UI (#10).

## Capabilities

### New Capabilities
- `app-store-icons`: App Store icon, dark and tinted appearances and Icon Composer layers from the logo.

### Modified Capabilities
- `media-specs`: entries for the dark and tinted appearances and the Icon Composer layers.

## Impact

- New `src/core/generators/app-store-icons.ts`, palette and greyscale support in `src/core/generators/render.ts`,
  new routes in `src/server/generate-routes.ts`, new entries in `src/core/specs/apple.ts`.
