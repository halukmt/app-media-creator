# Tasks

## 1. Fixes

- [x] 1.1 Stage batch writes in `registerOutputs`; verify a test where the second target is a directory leaves the first file and the manifest unchanged and no `.tmp` files
- [x] 1.2 Auto-orient logos in `loadLogo`, `renderLogoSquare` and `icon.svg`; verify a test with a JPEG logo with EXIF orientation 6

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review` on the change; findings recorded in the review log of `design.md`
