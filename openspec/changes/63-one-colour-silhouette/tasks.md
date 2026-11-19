# Tasks

## 1. Fix

- [x] 1.1 `renderSilhouette` cuts the background only when the source logo has a one-colour border and a mark; decided once per logo
- [x] 1.2 Factories `oneColourJpeg()`, `gradientJpeg()`, `outlineJpeg()`, `croppedWordmarkJpeg()`; tests for Android (one colour, gradient, ring at two densities, cropped wordmark) and the web variants
- [x] 1.3 CHANGELOG line under [Unreleased] → Fixed

## 2. Verification loop

- [x] 2.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 2.2 `/code-review`; findings in the review log
