# Tasks

## 1. Catalogue and helpers

- [x] 1.1 `web.logo.*` entries (group `logo`); verify catalogue tests
- [x] 1.2 `textBlockSvg` (name + tagline as paths, fitted); verify share image tests (no missing glyphs for de-DE / tr-TR)

## 2. Generator and API

- [x] 2.1 `generateShareImages` (share per locale, social shared, logo variants); verify spec validation, 300 KB, per-locale difference, one-colour variants, checklist flag
- [x] 2.2 `POST /api/generate/share-images`; verify 201 and 400 without a logo

## 3. Verification loop

- [x] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.2 `/code-review` and `security-review` (new route); findings in the review log
