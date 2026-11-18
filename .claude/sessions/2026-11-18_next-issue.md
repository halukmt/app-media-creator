# 2026-11-18 /next-issue

## #2 Spec catalogue and locale catalogue — done (PR #29)

- `src/core/specs/`: 70+ entries (Apple, Google Play, web/social) with sizes, formats, alpha rule, limits,
  `verified`, `sourceUrl`; `getSpec`, `listSpecs`, `validateMedia`, `inspectImage` (sharp).
- `src/core/locales/`: 6 locales, App Store Connect codes (`it`, `tr`), Google Play codes, `resolveLocales`.
- Main specs created: `openspec/specs/media-specs`, `openspec/specs/media-locales`.
- Notable:
  - sharp cannot read ICO → noted in #8.
  - sharp's libvips is LGPL-3.0-or-later (dynamic, not vendored) → licence audit in #25.
  - Unverified entries (X, WhatsApp, social sizes, TV screenshots, some favicons) show `verified: false`.
  - GitGuardian runs on PRs (GitHub app on the account), besides gitleaks and CodeQL.
- Next candidates: #3 (workspace, depends on #2 only), then #5 (export) and the logo packs.
