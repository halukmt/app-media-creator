# Tasks

## 1. Settings and API

- [x] 1.1 `logo-settings.ts` (validate, lenient read, save); verify round trip and 400 for invalid taglines
- [x] 1.2 `logo-packs.ts` (`generateLogoPack`, `listLogoOutputs`); verify web pack uses the stored background
- [x] 1.3 Routes logo preview, settings, generate per pack, logo output, output file; verify refusals (documents, non-manifest paths, symlinks) and downscale

## 2. UI

- [x] 2.1 `OptionGroup` swatch, `PreviewCard` optional media and size, `SectionLayout` hint; INVENTORY rows updated
- [x] 2.2 `LogoPage` steps Upload, Options (packs, background, taglines, autosave), Preview (generate all, grouped grid), Export
- [x] 2.3 `groupOutputs` / `groupStatus`; verify unit tests

## 3. Verification loop

- [x] 3.1 E2E: upload → options → generate all → ZIP with files per target; axe and screenshots at 375 / 768 / 1280 px
- [x] 3.2 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.3 design-critic, `/code-review` and `security-review` (new routes); findings in the review log
