Issue: #18

# Proposal

## Why

iOS 27 shows an optional product page header and a search results asset (image or looping video). Apple asks for key
art inside an art safe area, a background across the rest, and one short localized phrase. The catalogue already had
the specs (header 3840×1646, search 3:2 up to 3840×2560, universal 5244×2950, PNG without alpha, with safe areas);
nothing generated them, and the Screenshots section showed the purpose as "Comes later".

## What Changes

- Settings `<workspace>/creative.json`: background (presets and logo colours, as for cards) and one phrase per locale
  (up to 60 characters). API `GET/PUT /api/creative/settings`.
- Renderer: the phrase and one device with the first screenshot inside the safe area (device on the right, phrase on
  the left, or the device centred without a phrase); a row of devices of the same size outwards on both sides that
  fades towards the edges, in the auxiliary area the App Store may crop. Device shadows are pre-blurred by sharp
  (the SVG filter took 22 s for one universal image).
- Generator `generateCreativeAssets`: header, search (rendered at 3840×2560, the size the safe area is given for; new
  `defaultSize` in the catalogue) and universal images per selected locale from the first three screenshots of the
  locale's set (source-language fallback flagged), validated against the specs, written to
  `apple/<locale>/creative-<…>-image/01-<name>.png`. API `POST /api/generate/creative-assets`.
- Preview API `POST /api/creative/preview` returns a small render, the full size and the safe area.
- UI: the Screenshots purpose "Product page header and search asset" is enabled (disabled with a note when the App
  Store is off): background and phrases in the purpose step, three previews with a "Show safe area" guide, generation
  per language. New component `LocaleTextFields` (also used for the Logo taglines); `PreviewCard` gets a `guide` prop.

Acceptance criteria from the issue:
- Header 3840×1646 PNG, search results 3:2, universal 5244×2950 PNG; no alpha.
- Key art inside the art safe area; safe-area guide overlay in the preview.
- One short localized phrase per locale.
- Spec validation and tests.

Targets: Apple App Store. Locales: all 6 (tests with de-DE and tr-TR). Looping video versions come with M5 (#21).

## Capabilities

### New Capabilities
- `creative-assets`: App Store header, search results and universal images.

### Modified Capabilities
- (none)

## Impact

- New: `src/core/workspace/creative-settings.ts`, `src/core/screenshots/creative.ts`,
  `src/core/generators/creative-assets.ts`, `src/web/components/LocaleTextFields.tsx`, `src/web/lib/creative.ts`, tests.
- Changed: `src/core/specs/apple.ts` (search `defaultSize`), `src/core/screenshots/device.ts` (`id` option),
  `src/server/generate-routes.ts`, `src/web/api.ts`, `src/web/components/PreviewCard.tsx`,
  `src/web/pages/ScreenshotsPage.tsx`, `src/web/pages/LogoPage.tsx`, `src/web/i18n/en.ts`,
  `src/web/components/INVENTORY.md`.
