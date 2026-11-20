Issue: #111

# Proposal

## Why

Two Codex findings on PR #110. The Video section sent the saved card and device-video texts of every language ever
typed; after a language was removed in Project, the generators rejected its key and no video could be made, while the
field of the removed language was hidden. And the result cards showed the catalogue's portrait size for landscape
previews.

## What Changes

- `videoRequestBody` (`src/web/lib/video.ts`, pure, tested) builds the generate request and keeps only the texts of
  the requested languages; `generateVideos` in `api.ts` uses it.
- The result cards read the size from the player's metadata (`videoWidth` / `videoHeight`) instead of the catalogue.

Acceptance criteria from the issue:
- Only the texts of the requested languages are sent; making videos works after a language was removed.
- The result card shows the size of the generated video itself.
- Unit test for the request body; e2e coverage for the size.

Targets: App Store, web / social. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; the documented behaviour of the Video section is unchanged, so no delta spec: `skip_specs`)

## Impact

- `src/web/lib/video.ts`, `src/web/api.ts`, `src/web/pages/VideoPage.tsx`; tests `tests/unit/web-video.test.ts`,
  `tests/e2e/video.spec.ts`.
