# Tasks

## 1. Fix

- [x] 1.1 `downloadExport` takes an optional `AbortSignal`
- [x] 1.2 `ExportPage`: abort the running download on a selection or project change; one download at a time
- [x] 1.3 E2E: changing the languages during a slow download saves nothing and shows no result; a second click sends no request
- [x] 1.4 CHANGELOG line under [Unreleased] → Fixed

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review`; findings in the review log
