Issue: #20

# Proposal

## Why

App Store product pages show up to three app previews per device size and language. Apple's limits are strict
(15–30 s, H.264 up to 30 fps at 10–12 Mbps, stereo AAC, fixed sizes) and previews may only show real app footage.
Users have a screen recording; the tool should turn it into spec-conform previews per language without a video editor.

## What Changes

- `src/core/video/`: ffmpeg / ffprobe helpers (`FFMPEG_PATH`, new `FFPROBE_PATH`, ffprobe next to ffmpeg), `probeVideo`
  (size as displayed, fps, duration, audio), `planPreview` (trim, cards, cut to 30 s, reject < 15 s), `previewArgs`
  (one ffmpeg run: scale + pad in the card background colour, 30 fps, fades, text cards, own audio or silent stereo,
  H.264 High 4.0 at constant 11 Mbps, AAC 256 kbps), `renderTextCard` (text as paths with the bundled font),
  `renderFrame`.
- Generator `generateStorePreviews`: per selected project language its own recordings (up to 3) or the source
  language's (fallback input); iPhone 886×1920 always, iPad 1200×1600 when the project picked an iPad size; landscape
  recordings get the landscape size; every output measured with ffprobe and validated before anything is written;
  iPhone Duo warning (experimental); clear errors for a missing ffmpeg and a too short recording.
- `renderPreviewFrame` for choosing the poster frame (App Store Connect sets it per preview).
- API: `GET /api/video/tools`, `POST /api/generate/store-previews`, `GET /api/video/frame`.
- Export checklist measures videos with ffprobe (warning when ffprobe is missing).
- CI installs ffmpeg; `.env.example` and README document `FFPROBE_PATH` and previews.

Acceptance criteria from the issue:
- 886×1920 (iPhone), 1200×1600 (iPad); 15–30 s; H.264 ≤ 30 fps 10–12 Mbps; stereo AAC (silent track if no audio).
- Trim, scale / pad, simple fades, text cards per locale; no effects that imply functions the app lacks.
- Poster frame selection; ffprobe-based validation.
- iPhone Duo export marked experimental.
- Clear message when ffmpeg is missing.

Targets: App Store. Locales: all 6 (text cards per locale, one / several / all).

## Capabilities

### New Capabilities
- `store-preview-videos`: App Store preview videos from screen recordings.

### Modified Capabilities
- `export`: videos are measured in the checklist.

## Impact

- New: `src/core/video/`, `src/core/generators/store-previews.ts`, `src/server/video-routes.ts`,
  `tests/unit/store-previews.test.ts`, `tests/factories/video.ts`.
- Changed: `src/core/jobs/frames.ts` (uses the shared tools), `src/core/export/{checklist,zip}.ts`,
  `src/core/specs/apple.ts` (Duo note), `src/server/{app,generate-routes}.ts`, CI, `.env.example`, README.
- The Video section UI is #23; it builds on these routes.
