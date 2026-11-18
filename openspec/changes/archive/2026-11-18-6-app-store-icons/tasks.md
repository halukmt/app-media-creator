# Tasks

## 1. Catalogue and rendering

- [x] 1.1 Add `apple.icon-dark`, `apple.icon-tinted`, `apple.icon-layer-background`, `apple.icon-layer-foreground`; verify catalogue tests
- [x] 1.2 Add `grayscale` to `renderLogoSquare` and `logoPalette`; verify unit tests (greyscale keeps alpha; two-colour palette order)

## 2. Generator

- [x] 2.1 Add `generateAppStoreIcons` (safe area, background, appearances, layers, validation, batch registration); verify tests for SVG and PNG logos, opaque corners, transparent appearances, greyscale tint, clamped scale and missing logo

## 3. API

- [x] 3.1 Add `POST /api/generate/app-store-icons` and `GET /api/logo/palette`; verify server tests for success, invalid input and missing logo

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review` and `security-review` on the change; findings recorded in the review log of `design.md`
