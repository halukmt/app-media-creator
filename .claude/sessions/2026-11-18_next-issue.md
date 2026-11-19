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

## #51 Review finding from #50 — done (PR #52)

- Codex on PR #50: user bezel shadow darkened the screenshot edges. Bezel now drawn twice (shadowed beneath, plain on
  top). The test bezels had no real opening (`dest-out` with a transparent shape removes nothing) — fixed.
- CI e2e took about 5 minutes this time (usually under 1); keep an eye on it.

## #53 Review finding from #52 — done (PR #54)

- Codex on PR #52: `feDropShadow` in the lower layer drew the bezel twice → shadow-only filter (blur SourceAlpha,
  offset, flood, composite). Lesson: for a "shadow layer" never use feDropShadow (it merges the source).

## #12 Screenshot inputs per locale and device matrix — done (PR #55)

- `specs/matrix.ts` (SCREENSHOT_MATRIX) drives `deviceOptions`; old project.json devices outside it are dropped on read.
- `<workspace>/screenshots.json` (style + sets + known) via `readScreenshotSets` / `saveScreenshotSets`; lenient read,
  `known` keeps removed screenshots out. `effectiveSet` = own set or source set (fallback input).
- `generateScreenshotCards` renders everything first, caches identical cards, replaces all matrix devices per locale,
  warns `too-few-screenshots`. API: GET/PUT /api/screenshots, POST /api/generate/screenshot-cards.
- Codex on PR #54: no findings. Next: #14 Screenshots section UI (needs component-architect + daisyui).

## #14 Screenshots section UI — done (PR #56)

- `ScreenshotsPage` with steps (StepsBar via SectionLayout), upload per language, purpose (cards / frame only), slot
  editor with previews inside the slots, generate per language. New components: OptionGroup (LocaleSelector on it),
  StepsBar, FileField, SlotEditor, PreviewCard, ProgressStatus, ToggleField.
- Server: GET /api/inputs/file, POST /api/screenshots/preview, GET /api/screenshots/backgrounds; per-slot overrides.
- Learnings: debounced autosave needs a flush before upload/generate/unmount; DaisyUI `btn` is nowrap (chips need
  `whitespace-normal`); DaisyUI card-side forces img height (use `h-auto!`); Windows rename EPERM under parallel reads.
- Codex on PR #55: no findings. Remaining Ready: #10 (blocked by #9), #9 (P2), #34 (P2).

## #57 Review finding from #56 — done (PR #58)

- Codex on PR #56: failed save was swallowed. New `src/web/lib/save-queue.ts` (newest wins, failure keeps the edit,
  flush waits for and fails with a running save); upload/generate stop on a failed flush.

## #59 Review finding from #58 — done (PR #60)

- Codex on PR #58 (P1): a failed older save could be restored after a newer version was already queued → version
  counter; restore only if still the latest. Regression test checked to fail on the old code.

## #9 Share and social images — done (PR #61)

- `generateShareImages`: OG / X / WhatsApp (JPEG ≤ 300 KB) per locale with tagline; profiles, banners, email signature;
  logo variants `web.logo.*`. `textBlockSvg` now shared with the card renderer (goldens unchanged).
- Default background white (a logo colour hid the logo). Taglines in the request; storing them belongs to #10.
- Watch: CI e2e took 7m48s on PR #61 (usually ~1 min); if it repeats, look at the screenshots e2e / runner load.
- Next: #10 Logo section UI (now unblocked).

## #10 Logo section UI — done (PR #65)

- LogoPage: Upload → Options (packs, solid background from presets + palette, taglines per locale, autosave to
  `logo.json`) → Preview (Generate all per pack with progress; grid grouped per asset + locale via `src/web/lib/logo.ts`)
  → Export. API: logo preview, logo settings, `generate/logo/:pack`, logo output, `/api/output/file` (manifest images,
  own files only, downscale).
- Grouping took the 375 px preview from 11 453 px to ~8 100 px; checkerboard behind logo previews.
- Review fixes: stale taglines of removed locales ignored, empty locale selection, reload keeps unsaved settings, e2e
  ZIP step waits for dialog or download.
- New issues: #62 clipped app name on share images without tagline (Ready, P1/XS — shared generator code),
  #63 empty monochrome layer for one-colour opaque logos (Backlog), #64 deferred polish (Backlog).
- CI e2e back to 1m23s (the 7m48s on #61 did not repeat).
- Next: #62, then #34.

## #62 Clipped app name on share images — done (PR #66)

- Root cause: opentype.js 2.0 `toPathData` → `roundDecimal` appends `"e+2"` to the decimal part as a string; a
  decimal part like 5.7e-14 gives `NaN` (cached). librsvg stops the path at `NaN` → text cut off. Position/size
  dependent, so it hit "Demo" without tagline but not "demo-repo".
- Fix: own `pathData` in `fonts.ts` (shortest 2-decimal form, throws on non-finite / unknown commands); unit test bans
  `toPathData` / `toSVG` in `src/`. Regression test verified to fail on old code. Goldens unchanged.
- Next: #34 (only Ready issue left).

## #34 Icon variants for preview / test installs — done (PR #67)

- `project.environments` (id, badge ≤ 10, colour preset, style badge | blueprint; max 5; default preview). Ids equal to
  a lower-case language code are reserved (case-insensitive file systems).
- Manifest `environment` → `<target>/<environment>/<segment>/…`; part of the set position. Icon generators write
  production + all environments in one batch with `replaceSets` (removed environments get deleted on regeneration).
- `src/core/generators/environments.ts`: label pill in the mask-safe circle (radius 0.46 / adaptive 33/108 /
  maskable from catalogue safe area), colour bar < 64 px, blueprint = gradient + grid + silhouette outline (erosion via
  blur; note: sharp returns sRGB after blur → `extractChannel(0)`).
- Checklist: environment sets as own items in project order; stale ones warned and excluded from the ZIP.
- UI: `EnvironmentCard` on the Project screen; Logo preview "Icon set" filter; docs/icon-variants.md.
- One unit-test run had a single unexplained failure (likely a timeout under load); 3 reruns and CI green. Watch.
- Ready list is now empty (Backlog: #30, #42, #47, #48, #63, #64, M3–M7).

## #68 Environment labels without glyphs — done (PR #69)

- Codex finding on PR #67. `validateProject` rejects labels with characters missing in the icon font
  (`cardFont(800).missing`), error at `environments.<n>.badge`; Project screen shows it at the field (e2e).
- Ready list empty after this run; loop stopped.

## Backlog prioritised by Haluk's go (2026-11-19)

- Order: #48, #63, #70 (new: no default `preview` environment) → M4 (#18, #19) → M6/M3 (#24 raised to P1, #15, #16)
  → M5 video → small items (#42, #64, #30, #47) → M7. Ready now: #48, #63, #70, #18, #19, #30.
- Haluk does not want a direct store upload feature and needs no upload checkpoint (tests uploads from his app repo).
- Codex on PR #69: no findings.

## #48 Download guard on the Export page — done (PR #71)

- `ExportPage` keeps the running download's `AbortController` in a ref; the checklist effect's cleanup aborts it on a
  selection / project change and on unmount; the selection is compared by content (`localeKey`). One download at a time.
- E2E holds `/api/export` back via `page.route`, waits for `requestfailed`, verified to fail on the old code.
  Playwright does not click an `aria-disabled` button without `force: true`.
- Limit: the server still finishes an aborted `createExport`; noted on #47.
- One unit-test failure under full-suite load (`framed-screenshots` "removes the files of a deleted screenshot"),
  green alone and on rerun — second flaky occurrence after #34; watch, file an issue if it repeats.
- CI e2e took 6m19s again (usually ~1–2 min).
