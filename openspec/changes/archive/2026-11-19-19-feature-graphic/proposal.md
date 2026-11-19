Issue: #19

# Proposal

## Why

Google Play requires a feature graphic (1024×500, no alpha, key elements centred); without it no listing is complete.
App Store in-app events take a card (16:9) and a details image (9:16) without own text or borders. The catalogue had
the specs; nothing generated them, and the Screenshots purpose "Feature graphic" was disabled.

## What Changes

- The store artwork generator from #18 gets groups: `header` (App Store header, search, universal) and `feature`
  (Google Play feature graphic, App Store event card and details image). `generateCreativeAssets(…, { group })`;
  only images of enabled stores are made; each run replaces the whole group of a language.
- Images without a store safe area get a centred key area (feature graphic 70 % × 80 %, event card 50 % × 76 %,
  event details 80 % × 50 % in the upper half, where Apple's title overlay does not reach). Event images draw no phrase.
- Event images render at 3840×2160 and 2160×3840 (new catalogue `defaultSize`; Apple gives a range).
- The renderer centres phrase and key device as one group inside the key area (also improves the header images).
- `/api/catalogue` lists all six images with group, target, text flag and whether the area is the store's safe area.
- UI: the purpose "Feature graphic and in-app event images" is enabled (disabled with a note when neither store is
  on); it shares background and phrases with the header purpose; previews show the centred key area as the guide.

Acceptance criteria from the issue:
- Feature graphic 1024×500 without alpha, key elements centred, optional tagline per locale.
- In-app event card 16:9 and details 9:16 without own text or borders.
- Spec validation and tests.

Targets: Google Play, Apple App Store. Locales: all 6 (tests with de-DE and tr-TR).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `creative-assets`: feature graphic and in-app event images as a second group.

## Impact

- `src/core/generators/creative-assets.ts`, `src/core/screenshots/creative.ts`, `src/core/specs/apple.ts`,
  `src/server/catalogue-routes.ts`, `src/server/generate-routes.ts`, `src/web/api.ts`, `src/web/lib/creative.ts`,
  `src/web/pages/ScreenshotsPage.tsx`, `src/web/i18n/en.ts`; tests.
