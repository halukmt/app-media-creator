# Tasks

## 1. Fix

- [x] 1.1 Save queue with failure handling; verify `tests/unit/save-queue.test.ts` (newest wins, failure keeps edits, newer edit during failure, nothing pending)
- [x] 1.2 Screenshots page stops upload and generate on a failed flush; verify `npm run check` and the screenshots e2e

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review` on the change; findings in the review log of `design.md`
