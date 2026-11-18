# Tasks

## 1. Catalogue and fonts

- [x] 1.1 `defaultSize`, `maxTextShare`, `discouragesFrames` in the catalogue; verify catalogue tests
- [x] 1.2 Card font (Inter Latin + Latin Extended, glyph fallback, paths); verify glyph coverage tests for the 6 locales

## 2. Renderer

- [x] 2.1 Text wrapping, balancing and fitting; verify layout unit tests
- [x] 2.2 Backgrounds, frames, layouts, user bezels; verify unit tests
- [x] 2.3 `renderScreenshotCard`, `cardSizeForSpec`, `cardDefaultsForSpec`; verify spec validation, warnings and golden images (de-DE, tr-TR)

## 3. Verification loop

- [x] 3.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.2 `/code-review` and `security-review` (file handling of user frames, SVG rendering); findings in the review log
