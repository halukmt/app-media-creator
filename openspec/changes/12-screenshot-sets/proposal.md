Issue: #12

# Proposal

## Why

The card renderer (#11) draws one card. To produce a store listing the tool needs, per language, the ordered set of
screenshots with their headlines, the store devices to render, and a way to generate one, several or all languages —
with languages that have no own screenshots falling back to the source language.

## What Changes

- **Device matrix** in the catalogue: iPhone 6.9", 6.5", 6.3", iPhone Duo outer and inner, iPad 13" for the App Store;
  phone, 7" and 10" tablet for Google Play. The Project screen offers exactly these devices.
- **Screenshot sets** in `<workspace>/screenshots.json`: per locale an ordered list of entries (screenshot, headline,
  subline) plus the card style (layout, background). New uploads are appended automatically, deleted ones dropped;
  a set holds at most 10 entries (App Store maximum). Saving a new order moves the texts with their screenshot.
- **Fallback:** a locale without an own set uses the source locale's set; such cards are marked "fallback input"
  in the manifest and the export checklist.
- **Generator:** renders cards for the selected locales × the project's enabled matrix devices × the set, at most the
  device's catalogue maximum (Google Play 8). Each locale is one batch that replaces its earlier cards. Text warnings
  of the renderer are returned with the output path.
- **API:** `GET` / `PUT /api/screenshots`, `POST /api/generate/screenshot-cards` with optional `locales`.

Acceptance criteria from the issue:
- Device matrix: iPhone 6.9" / 6.5" / 6.3", iPhone Duo outer and inner, iPad 13"; Android phone, 7" and 10" tablet.
- Ordered screenshot set per locale (max 10 Apple, 8 Play); reordering keeps headlines attached.
- Locales without own uploads use the source-language screenshots and are marked "fallback input".
- Generate for one locale, several or all.

Targets: App Store, Google Play. Locales: all 6, one, several or all.

## Not in this change

- The Screenshots section UI (#14): upload, reorder, edit texts, style picker, previews.
- AI-written headlines (M3); per-screenshot layout or background.

## Capabilities

### New Capabilities
- `screenshot-sets`: ordered screenshot sets per locale and card generation for the device matrix.

### Modified Capabilities
- `workspace`: the device models a project can pick are the device matrix.

## Impact

- New `src/core/specs/matrix.ts`, `src/core/workspace/screenshot-sets.ts`, `src/core/generators/screenshot-cards.ts`;
  `src/core/workspace/project.ts`, `workspace.ts`; `src/core/screenshots/render.ts` (preloaded user bezel);
  `src/server/workspace-routes.ts`, `generate-routes.ts`.
