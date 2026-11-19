# Tasks

## 1. Settings and layout

- [x] 1.1 `environments` in project settings (schema, default, unique ids, reserved names); verify validation tests
- [x] 1.2 Manifest `environment` (path, position, entry check); verify path and rejection tests

## 2. Rendering and generators

- [x] 2.1 `environments.ts`: badge pill, colour bar under 64 px, blueprint background and outline, `variantRenderer`
- [x] 2.2 App Store, Android and web generators write a set per environment with `replaceSets`; verify production unchanged, specs valid, removal
- [x] 2.3 Checklist items per environment; verify no errors and separate items

## 3. UI and docs

- [x] 3.1 Catalogue colours; `EnvironmentCard` (INVENTORY row first); Project screen section with add, remove, focus and field errors
- [x] 3.2 Logo preview and ChecklistCard show environments as separate assets
- [x] 3.3 `docs/icon-variants.md` and README link

## 4. Verification loop

- [x] 4.1 Unit tests for both styles with a transparent SVG and a flat PNG logo; e2e for the Project editor and the ZIP
- [x] 4.2 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.3 `/code-review`, `security-review`, design-critic; findings in the review log
