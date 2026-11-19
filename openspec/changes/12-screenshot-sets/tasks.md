# Tasks

## 1. Data

- [x] 1.1 Device matrix in the catalogue; `deviceOptions` uses it; verify project tests (matrix, device outside the matrix)
- [x] 1.2 Screenshot sets document with validation, merge with uploads, fallback; verify set tests (order, reorder keeps texts, invalid sets, fallback)

## 2. Generation and API

- [x] 2.1 `generateScreenshotCards` per locale × device × set; verify paths, fallback flag, checklist warning, one locale, Play maximum, errors
- [x] 2.2 `GET` / `PUT /api/screenshots`, `POST /api/generate/screenshot-cards`; verify API tests

## 3. Verification loop

- [ ] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [ ] 3.2 `/code-review` and `security-review` (new routes, file reads by stored paths); findings in the review log
