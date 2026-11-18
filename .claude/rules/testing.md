---
paths:
  - "tests/**"
  - "**/*.test.ts"
  - "**/*.spec.ts"
---

# Testing standard

Adapted from ki-mal-mit (rule RULE-TESTING-3301 from the CCAF cookbook).

- Every test file starts with the comment line `// conventions: RULE-TESTING-3301`.
- `describe` and `test` names are full English sentences ("rejects an image with an alpha channel").
- Every test file covers at least one good case and one failure case.
- Test behaviour, not implementation details: roles, labels and visible text instead of CSS classes
  (`getByRole`, `getByLabel`).
- Test data comes from factory functions in `tests/factories/`, no scattered literals.
- Mock external services at the module boundary (Anthropic API, ffmpeg where a real run is too slow).

## Split

- **Vitest (`tests/unit/`):** core logic — specs catalogue, locales, renderers, validators, zip layout,
  job folder contract, CLI arguments, server routes (`app.request`).
- **Renderer tests:** assert real output (dimensions, alpha, format, file size via sharp; duration, fps, audio
  via ffprobe). Run at least for `de-DE` and `tr-TR`. Golden images live in `tests/golden/`.
- **Playwright (`tests/e2e/`):** user flows against the built CLI (upload → generate → export ZIP → assert file list).
- **Accessibility:** `@axe-core/playwright` in every page test; `serious` or `critical` violations fail the test.
- **Screenshots:** each section at 375, 768 and 1280 px into `test-results/screenshots/`, the basis for `design-critic`.
