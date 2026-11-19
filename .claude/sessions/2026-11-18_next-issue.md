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

## #6 Logo pack: App Store icon set — done (PR #40)

- `apple/shared/icon/` (app-icon, app-icon-dark, app-icon-tinted) and `apple/shared/icon-composer/` (background, foreground).
- Logo box 40–80 % (default 70 %); palette endpoint for background suggestions (UI #10).
- Shared helpers: `generators/logo.ts` (newest logo, GeneratorError), `generators/outputs.ts` (fixedSizes, squareSize,
  assertValidOutputs). Routes pass values; generators validate.
- Bash heredocs with apostrophes failed twice in the Bash tool; write multi-line scripts as files instead.

## #7 Logo pack: Google Play icon and Android adaptive icons — done (PR #41)

- `google/shared/icon/play-icon.png` (512, 32-bit, opaque); `google/shared/android-res/mipmap-*/` adaptive layers
  (logo box 66/√2 dp, floor) + legacy icons; `mipmap-anydpi-v26/ic_launcher.xml`.
- Output paths support one `subfolder`; writes never follow linked folders; `rasterizeLogo` once per run.
- Codex finding on PR #40 (bounded SVG decode) folded into #7.
- vitest `testTimeout` raised to 20 s (generator tests under parallel load).
- Follow-up for Expo icon export filed (Backlog, P2/S).
- Haluk renamed project 10 and deleted project 11. Asked how Codex feedback is handled; offered to reply on PR
  threads and to check all PRs merged since the last run (not yet in the skill).

## #4 App shell with sections and locale selector — done (PR #43)

- First UI: `layouts/AppShell` (drawer, hash routing `#/<section>`), `pages/ProjectPage`, generic `pages/SectionPage`
  (locale bar + empty state for the five not-yet-built sections; later issues replace the empty state).
- Components (inventory): EmptyState, FieldError, LocaleSelector, PageHeader, StatusAlert, TargetCard, TextField.
  Pure helpers in `src/web/lib/` (sections, locale selection, claim lines, error grouping), UI text in `src/web/i18n/en.ts`.
- `GET /api/catalogue` (locales + device models); the UI mirrors API types in `src/web/api.ts` (no `import type` from
  core: the web tsconfig would then check core files that need Node types).
- Learnings: `alert-soft` fails axe contrast (use solid alerts); sr-only inputs inside button labels need label clicks in
  Playwright; Playwright wipes `test-results/` on every run; one e2e test per section and width (long tests time out
  under parallel load); the Play icon unit test asserted per pixel and timed out — now one assertion.
- Codex on PR #41: no findings.

## #44 Review findings from #43 — done (PR #45)

- Codex on PR #43: focus could not return to the menu button while the page was still `inert` (moved into an effect
  after commit); crossing the `lg` breakpoint with the drawer open left the page inert (`matchMedia` listener closes it).
- Both new e2e tests were checked to fail against the old code.

## #32 Export section UI — done (PR #46)

- `ExportPage`: Download first (status, hint, button, confirmation), then the checklist per store grouped by asset
  (`groupBySpec`, language badges, messages in a Details collapse). New: `SectionLayout` (layout), `SectionEmptyState`,
  `StatusBadge`, `RequiredBadge`, `BusyButton`, `ConfirmDialog`, `ChecklistCard`.
- Playwright projects: `export` depends on `settings` (project.spec), `chromium` runs the rest in parallel.
- Follow-up idea, not filed: stream the ZIP download instead of a Blob once video exports exist.
- Codex on PR #45: no review yet at the start of this run; check at the next start.

## #11 Screenshot card renderer — done (PR #49)

- `src/core/screenshots/`: SVG → sharp; text as paths via opentype.js + Inter (@fontsource, OFL), glyph by glyph
  (opentype.js 2 throws on Inter's ccmp table → no ligatures, no kerning). satori/resvg rejected: MPL-2.0.
  Rules §3/§7/§8 updated (stack line, frames in code, OFL fonts allowed).
- Catalogue: `defaultSize` (range specs), `maxTextShare`, `discouragesFrames`; `cardDefaultsForSpec`.
- Renderer validates its input (`CardInputError`), ready for an HTTP route in #12/#14. Landscape cards rejected for now.
- Golden images in `tests/golden/` (295×640, 3 layouts × de-DE/tr-TR), same result on Windows and Linux CI.
- Codex on PR #46: race between download result and selection change → #48 (Backlog, P2/XS).

## #13 Frame-only screenshots for websites — done (PR #50)

- `generateFramedScreenshots` → `web/<locale>/framed-screenshots/<1x|2x>/NN-<name>.png|webp`; only languages with own
  screenshots; a run replaces the sets of its languages (`registerOutputs(..., { replaceSets })`).
- Manifest set position now includes `subfolder`. Catalogue: group `mockup`, field `baseWidth`.
- Device drawing shared in `screenshots/device.ts`; user bezels in `<workspace>/frames/user/` (`Workspace.userFramesDir`).
- Codex on PR #49: review status "failed" (no findings delivered).
