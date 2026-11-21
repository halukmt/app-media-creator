## 1. Server

- [x] 1.1 `safeMediaHeaders` helper used by `/inputs/file`, `/inputs/logo-preview`, `/output/file` and `/video/frame`
- [x] 1.2 Preview cache for resized output previews and the logo preview
- [x] 1.3 `GET /api/inputs/logo-info` with `describeLogo`

## 2. UI

- [x] 2.1 Third-party note once per pack (Logo) and once above the results (Video); card state without it
- [x] 2.2 `srcSet` 240w / 480w for logo previews
- [x] 2.3 Count-aware generate label
- [x] 2.4 Size and validation badge on the current-logo card

## 3. Tests and checks

- [x] 3.1 Unit tests (logo info, cache, card state) and e2e update
- [x] 3.2 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`; `/code-review`, `security-review`, `design-critic`; CHANGELOG
