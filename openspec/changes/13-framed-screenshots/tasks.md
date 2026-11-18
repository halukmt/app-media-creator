# Tasks

## 1. Catalogue and manifest

- [x] 1.1 `web.framed-screenshot` and `-webp` in group `mockup`; verify catalogue and project tests (no new device models)
- [x] 1.2 Subfolder in the set position; verify manifest test for 1x / 2x side by side

## 2. Rendering and generator

- [x] 2.1 Move device drawing to `device.ts`, shadow switch; verify card golden images unchanged
- [x] 2.2 `renderFramedScreenshot`; verify alpha, size with and without shadow, input errors
- [x] 2.3 `generateFramedScreenshots` and `POST /api/generate/framed-screenshots`; verify file list, 2x size, skipped locales, checklist status, API errors

## 3. Verification loop

- [x] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.2 `/code-review` and `security-review` (new route, file reads); findings in the review log
