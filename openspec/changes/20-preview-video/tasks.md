## 1. Video core

- [x] 1.1 `src/core/video/tools.ts` (binaries, process helpers, tool check); `jobs/frames.ts` uses it
- [x] 1.2 `probe.ts` (`parseProbe`, `probeVideo`) with tests
- [x] 1.3 `preview.ts` (`planPreview`, `orientedSize`, `previewArgs`, `renderTextCard`, `renderPreview`, `renderFrame`) with tests

## 2. Generator and API

- [x] 2.1 `generateStorePreviews` (locales, fallback, devices, Duo warning, validation, registration) and `renderPreviewFrame`
- [x] 2.2 `GET /api/video/tools`, `POST /api/generate/store-previews`, `GET /api/video/frame` with tests

## 3. Export

- [x] 3.1 Checklist measures videos with ffprobe (warning without ffprobe); ZIP passes `measureVideo`

## 4. Docs, CI

- [x] 4.1 Duo note in the catalogue, `FFPROBE_PATH` in `.env.example`, README, ffmpeg in CI

## 5. Final check

- [x] 5.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 5.2 `/code-review`, `security-review`; CHANGELOG under Added
