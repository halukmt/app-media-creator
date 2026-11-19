## 1. Catalogue and frames

- [x] 1.1 `web.video.vertical|landscape|square` entries, asset group `video`
- [x] 1.2 `frameOverlaySvg`; `renderCreativeAsset` returns the key screen and overlay

## 2. Video core

- [x] 2.1 `src/core/video/compose.ts` (layout, layers, loop and clip plans, args, render) with tests
- [x] 2.2 `src/core/generators/recordings.ts`, used by the store previews too

## 3. Generators and API

- [x] 3.1 `generateEmbedVideos` and `generateLoopVideos` with real-render tests (screen content, seamless loop, de-DE and tr-TR)
- [x] 3.2 `POST /api/generate/embed-videos`, `POST /api/generate/loop-videos` with tests; README

## 4. Final check

- [x] 4.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.2 `/code-review`, `security-review`; CHANGELOG under Added
