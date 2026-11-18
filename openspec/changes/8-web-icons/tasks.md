# Tasks

## 1. Spec catalogue and export

- [x] 1.1 Add `folder`, document kind, `json`/`html`/`txt` formats and the `none` dimension rule; add `web.webmanifest` and `web.head-snippet`; put favicon entries into `favicons`; verify catalogue tests
- [x] 1.2 Measure ICO files in `inspectImage`; verify a test with a 16/32/48 ICO
- [x] 1.3 Checklist: documents are only checked for existence; `registerOutput` rejects a path of another spec; verify tests

## 2. Generator

- [x] 2.1 Add `src/core/generators/render.ts` (`renderLogoSquare`, `encodeIco`) and verify unit tests
- [x] 2.2 Add `generateWebIcons` and verify tests for an SVG logo, a transparent PNG logo, dark mode in `icon.svg`, manifest and head snippet, missing logo, and a clean export checklist for the web icons

## 3. API

- [x] 3.1 Add `POST /api/generate/web-icons` and verify server tests for success, missing logo and an invalid colour

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review` and `security-review` on the change; findings recorded in the review log of `design.md`
