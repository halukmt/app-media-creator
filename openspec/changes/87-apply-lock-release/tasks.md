# Tasks

## 1. Fix

- [x] 1.1 Release the edit lock only through a successful reload started after the apply; "Try again" only reloads
- [x] 1.2 Numbered reloads; lock released only by a reload started after the apply
- [x] 1.3 E2E test with a failing reload after apply; CHANGELOG (Fixed)

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review`; findings in the review log
