# Tasks

## 1. Fix

- [x] 1.1 Reproduce: generator output for "Demo" has `NaN` in the text path; standalone render of the same text is fine
- [x] 1.2 `pathData` in `fonts.ts` replaces `toPathData`; verify no `NaN` across sizes and positions

## 2. Tests

- [x] 2.1 Share images: ink width of the name on X card (tr-TR, no tagline), Open Graph (de-DE), Facebook cover, LinkedIn banner; verified to fail on the old code
- [x] 2.2 `pathData` formatting and non-finite values

## 3. Verification loop

- [x] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass (golden images unchanged)
- [x] 3.2 `/code-review`; findings in the review log
