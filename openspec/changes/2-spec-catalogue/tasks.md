# Tasks

## 1. Setup

- [x] 1.1 Add `sharp` as a runtime dependency and verify `npm ls sharp` shows it

## 2. Locale catalogue

- [x] 2.1 Implement `src/core/locales/` (6 locales, names, App Store Connect and Google Play codes, `resolveLocales`) and verify `tests/unit/locales.test.ts` covers codes, native names, "all", duplicates and an unsupported locale

## 3. Spec catalogue

- [x] 3.1 Implement `src/core/specs/types.ts` (entry, dimension rule, alpha rule, limits) and verify `npm run check` passes
- [x] 3.2 Add Apple entries (screenshots for all display classes incl. iPhone Duo, iPad, Mac, TV, Vision Pro, Watch; previews; header / search / universal; in-app events; icon) and verify the Apple lookup tests pass
- [x] 3.3 Add Google Play entries (icon, feature graphic, phone / tablet / Chromebook / Wear / TV / XR / Automotive screenshots, TV banner, adaptive icon layers) and verify the Google lookup tests pass
- [x] 3.4 Add web and social entries (favicons, touch icon, manifest, maskable, OG, X, WhatsApp, profile and banner sizes) with `verified: false` where unverified, and verify the web lookup tests pass
- [x] 3.5 Implement lookup and target filter (`getSpec`, `listSpecs`) and verify tests for unknown ids, completeness of every entry and the required Google Play set

## 4. Validation

- [x] 4.1 Implement the pure validator (dimensions fixed and range with aspect, formats, alpha, file size, duration, frame rate) and verify `tests/unit/specs-validate.test.ts` covers every scenario of the spec
- [x] 4.2 Implement the sharp-based image inspector and verify tests measure a generated PNG with alpha and reject a text file

## 5. Verification loop

- [x] 5.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 5.2 `/code-review` on the change; findings recorded in the review log of `design.md` and critical ones fixed
