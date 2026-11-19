# Tasks

## 1. Server

- [x] 1.1 Per-slot overrides, card preview, served uploads, background choices, device size in the catalogue; verify `tests/unit/screenshots-api.test.ts`
- [x] 1.2 Skipped languages cleaned per request; atomic write retry on Windows; verify unit tests

## 2. UI

- [x] 2.1 Reuse map and inventory rows before the files; verify `npm run check:inventory`
- [x] 2.2 OptionGroup (LocaleSelector on it), StepsBar in SectionLayout, FileField, ProgressStatus, ToggleField, SlotEditor, PreviewCard; verify existing e2e tests
- [x] 2.3 ScreenshotsPage with autosave flush, previews in slots, generation per language; verify `tests/e2e/screenshots.spec.ts`

## 3. Verification loop

- [x] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.2 `/code-review`, `design-critic`, `security-review`; findings in the review log
