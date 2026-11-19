Issue: #21

# Proposal

## Why

A screen recording is useful beyond App Store previews: websites and social posts want the app video in a device
frame on a branded background, and the App Store's product page header and search results accept short looping
videos (iOS 27). Both are layouts the tool already draws as images (#18); this change makes them move.

## What Changes

- Catalogue: `web.video.vertical` (1080×1920), `web.video.landscape` (1920×1080), `web.video.square` (1080×1080),
  new asset group `video`, unverified (common network sizes, not store rules), 1–60 s, up to 60 fps, up to 3.
- `src/core/screenshots/frames.ts`: `frameOverlaySvg` (the body with the screen cut out, plus the cutouts) for a video
  that plays in the screen; `renderCreativeAsset` also returns the key device's screen and that overlay.
- `src/core/video/compose.ts`: `embedLayout` (text and device per format), `renderEmbedLayers` (plate and overlay),
  `planLoop` (crossfade end into start, 5–30 s) and `planClip`, `composeArgs` (plate, recording scaled into the screen,
  frame on top; loop crossfade or fades; own audio or none), `renderComposite`.
- `src/core/generators/video-assets.ts`: `generateEmbedVideos` (per language and format, recordings with source
  fallback, optional text per language, background default from the header settings, audio kept) and
  `generateLoopVideos` (header 3840×1646 and search 1920×1280 with the header layout and phrase, first recording,
  seamless, muted, 30 fps).
- `src/core/generators/recordings.ts`: recordings per language with fallback, a probe cache and the post-render check,
  shared with the store previews.
- API: `POST /api/generate/embed-videos`, `POST /api/generate/loop-videos`. README.

Acceptance criteria from the issue:
- Embed export in 9:16, 16:9, 1:1 with optional text per locale.
- Header 21:9 and search 3:2 loop videos, 5–30 s, 30 or 60 fps, seamless loop, works muted.
- Validation and tests.

Targets: App Store, web / social. Locales: all 6 (text and phrases per locale, one / several / all).

## Capabilities

### New Capabilities
- `video-assets`: device videos for web and social and looping header and search videos.

### Modified Capabilities
- (none)

## Impact

- New: `src/core/video/compose.ts`, `src/core/generators/{video-assets,recordings}.ts`, `tests/unit/video-assets.test.ts`.
- Changed: `src/core/specs/{types,web}.ts`, `src/core/screenshots/{frames,creative}.ts`,
  `src/core/generators/store-previews.ts` (shared helpers), `src/server/video-routes.ts`, README.
