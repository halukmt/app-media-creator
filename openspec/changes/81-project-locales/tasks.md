## 1. Helper

- [x] 1.1 `selectProjectLocales(projectLocales, selection)` in `src/core/locales/index.ts` with unit tests (all, none,
      explicit, outside, unsupported next to "all", empty list)

## 2. Callers

- [x] 2.1 `selectExportLocales` uses the helper (ExportError)
- [x] 2.2 Screenshot cards, framed screenshots, share images and creative assets use the helper (GeneratorError)
- [x] 2.3 `createJob` uses the helper (JobError); message aligned with export

## 3. Tests

- [x] 3.1 Generator with "all" on a two-locale project writes only the project's locales; outside locale rejected
- [x] 3.2 AI job with "all" on a two-locale project

## 4. Final check

- [x] 4.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.2 `/code-review`; CHANGELOG line under Fixed
