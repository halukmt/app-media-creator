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

## #5 Export: validation checklist and ZIP builder — done (PR #33)

- `src/core/export/`: `outputPath` / `registerOutput` / `readManifest` (strict layout, invalid entries reported),
  `buildChecklist` / `checklistMarkdown`, `createExport` (streaming fflate ZIP, symlinks and foreign files refused).
- API: `GET /api/export/checklist?locales=…`, `POST /api/export`. Workspace gets `exports/`.
- Generators must use `registerOutput()`; folder segment = device for screenshots, spec id tail otherwise.
- Export UI split off as #32 (Ready, depends on #4).
- `THIRD_PARTY_NOTICES.md` added (runtime dependencies).
- Haluk asked to consider MustafaNatur/blueprint (comment on #6): Swift, macOS + Xcode only, MIT → idea only
  (preview / production icon variants), own cross-platform implementation; new issue for it.

## #35 Review findings from #33 — done (PR #36)

- Codex findings on PR #33 filed as #35 and taken right away (Ready, P1/XS) instead of Backlog, because the logo
  generators (#6–#8) register variant names next.
- `cleanOutputName()` (idempotent, keeps dots) replaces `safeBaseName()` for outputs; ZIP stream errors are handled.
- Main spec `export` updated (requirement "ZIP export by locale").

## #8 Logo pack: web favicons and manifest — done (PR #37)

- Generator pattern for #6/#7/#9: `src/core/generators/render.ts` (`loadLogo`, `renderLogoSquare`, `svgDensity`,
  `encodeIco`, `isHexColor`), sizes only from the catalogue (`fixedSizes`), validate buffers with
  `inspectImageBytes` + `validateMedia`, then `registerOutputs` as one batch.
- Catalogue: `folder` override, `document` kind (json/html/txt), `dimensions: none`; ICO measuring.
- API `POST /api/generate/web-icons`; routes share `readOptionalJsonObject`.
- Haluk denied a visual check script (wrote a temp script into scripts/); no real-logo preview yet → comes with #10.
- Haluk created a second GitHub project (#11) with more workflows; recommended: keep #10 (skills use 10, has
  "Released"), rename it, enable workflows in #10, delete #11 himself.

## #38 Review findings from #37 — done (PR #39)

- Codex findings on PR #37 taken right away (Ready, P1/XS), same reason as #35: shared code for #6/#7.
- `registerOutputs` stages to `.tmp`, checks targets are files, renames after all writes; cleans up on failure.
- `autoOrient()` in all logo render paths; `loadLogo` reports the displayed size.
- Haluk enabled all 7 built-in workflows on project 10 and will delete project 11. Checked: "Pull request linked"
  did not override the loop's "In review" status on #38; PRs are not auto-added to the board.
