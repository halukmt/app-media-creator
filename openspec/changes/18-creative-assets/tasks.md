# Tasks

## 1. Core

- [x] 1.1 `creative.json` settings with validation (background, phrases up to 60 characters, supported locales)
- [x] 1.2 `creativeLayout` and `renderCreativeAsset` (key art in the safe area, fading device row, fast shadow)
- [x] 1.3 `generateCreativeAssets` and `renderCreativePreview`; search `defaultSize` in the catalogue
- [x] 1.4 API: settings, preview, generate

## 2. UI

- [x] 2.1 component-architect reuse map; daisyui skill; INVENTORY row for `LocaleTextFields`
- [x] 2.2 `LocaleTextFields` (Logo taglines use it), `PreviewCard.guide`
- [x] 2.3 Screenshots purpose "header": options, previews with guide toggle, generation

## 3. Tests and docs

- [x] 3.1 Unit: layout for all three specs, render diff inside the safe area (de-DE vs tr-TR), settings, generation, API
- [x] 3.2 E2E: phrases, previews with guide, generate; preview at 375 / 768 / 1280 px with axe
- [x] 3.3 CHANGELOG (Added)

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review`, `security-review`, `design-critic`; findings in the review log
