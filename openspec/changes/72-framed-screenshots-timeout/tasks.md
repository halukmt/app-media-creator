# Tasks

## 1. Fix

- [x] 1.1 Capture the failure: `TestTimeoutError` after 20 s under full-suite load
- [x] 1.2 Measure alternatives (libvips threads, Vitest workers) and raise `testTimeout` to 60 s
- [x] 1.3 Three consecutive full `npm test` runs green
- [x] 1.4 CHANGELOG line under Fixed (every merge to dev adds one)

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review`; findings in the review log
