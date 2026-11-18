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

## #3 Workspace and project settings — done (PR #31)

- `src/core/workspace/`: `openWorkspace`, `readProject`, `saveProject` (zod, atomic, queued), `saveInput` / `listInputs`
  (content-based type detection incl. MP4 brands and QuickTime atoms, per-kind limits, safe names).
- Server: `GET/PUT /api/project`, `GET /api/inputs`, `POST /api/inputs/:kind`; `localOnly()` middleware; bind 127.0.0.1.
- CLI: `--workspace` / `-w` (default `.app-media`). E2E uses `test-results/e2e-workspace`.
- Main spec created: `openspec/specs/workspace`.
- Notable:
  - Codex findings on #29 filed as #30 (Backlog, P2, XS).
  - Security note on #10 and #14: serve uploaded SVGs with CSP sandbox / nosniff or rasterize them.
  - Large videos are still buffered in memory; streaming to disk belongs to #20.
- Next candidates: #5 (export), then #6/#7/#8 (logo packs) and #4 (app shell).
