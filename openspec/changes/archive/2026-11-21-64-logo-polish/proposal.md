Issue: #64

## Why

Deferred findings from the design-critic and code reviews of #10: the Logo section repeats the third-party note on
every card, previews are blurry on HiDPI screens, "Generate all" does not say what it makes, the current logo shows
no size or checks, and the server copies the same safe media headers six times and resizes every preview on each
request.

## What Changes

- The note "Size and limits come from third-party sources" is shown once per pack (and once above the Video results)
  instead of on every card; a card whose only message was that note shows "OK".
- Logo previews get a `srcSet` with 240 and 480 px wide copies.
- The generate button says how many packs it makes ("Generate 3 packs").
- The current-logo card shows the logo's size and format (or "SVG (vector)") and warns when a raster logo is smaller
  than the App Store icon or not square. New endpoint `GET /api/inputs/logo-info`.
- One helper builds the safe media headers for every inline media response.
- Resized output previews and the logo preview are cached in memory by file size and change time.
- The section → page map item of the issue is already done: `App.tsx` renders each section by its own condition
  since `SectionPage` was removed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `logo-section`: generate label, preview grid note and srcSet, output preview cache, current logo details.

## Impact

- Server: `src/server/safe-media.ts`, `src/server/preview-cache.ts`, `export-routes.ts`, `generate-routes.ts`,
  `video-routes.ts`, `workspace-routes.ts`.
- Core: `src/core/generators/logo.ts` (`describeLogo`, `loadUploadedLogo`), `src/core/export/checklist.ts` (message code).
- UI: `LogoPage.tsx`, `VideoPage.tsx`, `useOutputStatuses.ts`, `lib/logo.ts`, `api.ts`, `i18n/en.ts`. No new component.
