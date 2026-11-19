# Tasks

## 1. Core

- [x] 1.1 Groups `header` / `feature` in `CREATIVE_IMAGES` with key areas and text flag; enabled stores only
- [x] 1.2 Event image `defaultSize` (3840×2160, 2160×3840) in the catalogue
- [x] 1.3 Renderer centres phrase and key device as one group
- [x] 1.4 Catalogue lists all six images (group, target, text, store safe area); generate route takes `group`

## 2. UI

- [x] 2.1 Purpose "Feature graphic and in-app event images" enabled, shares the options panel; previews and generation per group

## 3. Tests and docs

- [x] 3.1 Unit: key area for all six images; feature group de-DE / tr-TR valid, event images identical, feature graphics differ; enabled stores only
- [x] 3.2 E2E: feature purpose previews and generation
- [x] 3.3 CHANGELOG (Added)

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review`, `security-review`, `design-critic`; findings in the review log
