# Tasks

## 1. Setup

- [x] 1.1 Add `fflate` as a runtime dependency and the `exports/` folder to the workspace; verify `npm ls fflate` and the workspace test for the new folder

## 2. Output manifest

- [x] 2.1 Implement `src/core/export/manifest.ts` (`outputPath`, `registerOutput`, `readManifest`) and verify `tests/unit/export-manifest.test.ts` covers the localized path, the shared path, the missing-locale rejection and replacing an entry

## 3. Checklist

- [x] 3.1 Implement `src/core/export/checklist.ts` and verify `tests/unit/export-checklist.test.ts` covers missing required, valid set, invalid file, too many files, fallback and unverified warnings, disabled target and a registered file that no longer exists

## 4. ZIP and API

- [x] 4.1 Implement `src/core/export/zip.ts` (locale selection against the project, streaming ZIP with `CHECKLIST.md`) and verify `tests/unit/export-zip.test.ts` covers one locale, all locales and a locale outside the project
- [x] 4.2 Add `GET /api/export/checklist` and `POST /api/export` and verify `tests/unit/server-export.test.ts` covers checklist JSON, ZIP download headers and the 400 for an unknown locale
- [x] 4.3 Add `tests/e2e/export.spec.ts`: seed outputs in the e2e workspace, download the ZIP through the API, unzip it and assert the file list

## 5. Verification loop

- [x] 5.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 5.2 `/code-review` and `security-review` on the change; findings recorded in the review log of `design.md` and critical ones fixed
