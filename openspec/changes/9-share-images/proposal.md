Issue: #9

# Proposal

## Why

Apps are shared on the web and in messengers: links need Open Graph, X and WhatsApp preview images, and the app's
social profiles need profile pictures and banners in many sizes. Logos are also needed as monochrome, inverse and
square-mark variants.

## What Changes

- Share images per locale from the newest logo: Open Graph 1200×630 and X card 1200×628 (PNG), WhatsApp preview
  1200×630 JPEG compressed under 300 KB; logo on the left, app name and an optional tagline per locale on the right.
- Shared by all locales: profile pictures (logo centred, circle-safe), banners (logo and name centred, inside the
  YouTube safe area), email signature logo (on transparency) for WhatsApp, Instagram, Facebook, LinkedIn, X, YouTube
  and TikTok.
- Logo variants: monochrome (black), inverse (white) and square mark, 1024×1024 PNG on transparency (new catalogue
  entries `web.logo.*`, group `logo`).
- A text block helper draws name and tagline as paths with the card font and fitting.
- API `POST /api/generate/share-images` with optional `background` (default white), `taglines` and `locales`.
- Unverified social sizes are flagged in the export checklist (existing behaviour for `verified: false`).

Acceptance criteria from the issue:
- Open Graph 1200×630, X large card, WhatsApp-safe preview (≤ 300 KB) with tagline per selected locale.
- Profile and banner sizes for WhatsApp, Instagram, Facebook, LinkedIn, X, YouTube, TikTok; email signature logo.
- Monochrome, inverse and square-mark logo variants.
- Unverified sizes are flagged in the export checklist.
- Tests for `de-DE` and `tr-TR` taglines.

Targets: web / social. Locales: all 6, one, several or all for the share images; the rest is shared.

## Not in this change

- UI for the Logo section (#10), which will offer backgrounds from the logo palette and store taglines.
- Per-network text on banners; animated images.

## Capabilities

### New Capabilities
- `share-images`: share images per locale, social profile and banner images, logo variants.

### Modified Capabilities
- `media-specs`: logo variant entries.

## Impact

- New `src/core/generators/share-images.ts`, `src/core/screenshots/text-block.ts`; `src/core/specs/{types,web}.ts`;
  `src/server/generate-routes.ts`; `tests/unit/share-images.test.ts`.
