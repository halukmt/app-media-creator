# Tasks

## 1. Fixes

- [x] 1.1 Add `cleanOutputName()` and use it in `outputPath()` and `registerOutput()`; verify a test registers `home.dark`, reads the manifest back and exports `01-home.dark.png`
- [x] 1.2 Handle write stream errors immediately in `createExport()`; verify a test with an exports path that is a file rejects with an error, leaves no ZIP and raises no unhandled rejection

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review` on the change; findings recorded in the review log of `design.md`
