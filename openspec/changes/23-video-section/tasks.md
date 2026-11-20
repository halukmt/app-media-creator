## 1. Server

- [x] 1.1 `video.json` settings with zod; `GET` / `PUT /api/video/settings`
- [x] 1.2 MP4 from `/api/output/file` with byte ranges
- [x] 1.3 `catalogue.videos` (size and length per video entry)

## 2. UI

- [x] 2.1 Reuse first: `TextField` `inputMode`, `useOutputStatuses`, `lib/frames.ts`, `lib/video.ts`
- [x] 2.2 `VideoPage` (Upload, Purpose, Options, Export) in `App.tsx`; generic `SectionPage` removed

## 3. Tests

- [x] 3.1 Unit: seconds and trim, purposes, settings validation, byte ranges, settings API
- [x] 3.2 E2E: upload, options saved, App Store preview made, axe at 375 / 768 / 1280; ffmpeg in the CI e2e job

## 4. Final check

- [x] 4.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.2 `/code-review`, `design-critic`, `security-review`; CHANGELOG under Added
