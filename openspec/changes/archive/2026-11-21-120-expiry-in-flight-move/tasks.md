## 1. Fix

- [x] 1.1 `drop()` awaits an in-flight move before deciding whether to remove the ZIP
- [x] 1.2 Unit test for the race (fails on the old code)

## 2. Final check

- [x] 2.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`; `/code-review`; CHANGELOG under Fixed
