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

## #63 One-colour logo silhouette — done (PR #73)

- `renderSilhouette` decides the background cut-out once per logo (`analyseBackground`, 512 px, WeakMap cache per
  logo buffer, rejected analyses not cached): cut only when ≥ 60 % of the border shares one corner's flat colour
  (tolerance 24) and ≥ 0.1 % of the pixels differ (tolerance 48). One-colour and gradient marks keep full coverage.
- First design (keep whole below 1 % kept pixels, per size) failed review: densities could disagree, line art near
  1 %, gradients still cut. Second review: edge-touching wordmarks → 60 % best corner. Tests for each case.
- Flaky unit test cause captured: `TestTimeoutError` 20 s in framed-screenshots → #72 (Backlog, P2/XS).
- Codex on PR #71: no findings.

## #74 Greyscale logo rasters (Codex on #73) — done (PR #75)

- Codex P2 on PR #73: `analyseBackground` read RGBA without converting greyscale. Taken right away (shared code, own
  regression). Not reproducible with sharp 0.35.5 (raw output already 4 channels for 8/16-bit grey PNG and grey JPEG).
- `readRgba(pipeline)` (sRGB, alpha, 8-bit, length check) now used by `logoPalette`, `analyseBackground`,
  `renderSilhouette`. CHANGELOG under Changed (hardening).
- #72 (20 s timeout in framed-screenshots) hit 3 of the last 5 full runs → raised to Ready, P1.

## #70 No default preview environment — done (PR #76)

- Haluk's decision: schema `environments` defaults to `[]`, `defaultProject()` lists none; stored lists are kept.
- No UI change needed (empty hint + Add, Logo "Icon set" filter hidden). Tests: API still returns variant
  environments, checklist/ZIP without variants, e2e empty Project section and no Logo filter.
- Accepted: pre-#34 project files without the field that generated preview icons now read as none (unreleased tool).
- Codex on PR #75: no findings.

## #72 Unit test timeout — done (PR #78)

- Cause: image tests take 5–8× longer in a full local run (parallel workers, Windows Defender scanning written PNGs);
  the framed-screenshots test (4 s alone) hit 20 s. Global `testTimeout` 60 s; per-test 30/60 s overrides removed.
- Measured: `sharp.concurrency(1)` 213 s, `--maxWorkers=4` 409 s (both worse than ~135 s). Mitigation only → #77
  (Backlog, P2/S: smaller fixtures, one temp root for an antivirus exclusion).
- The machine was heavily loaded (another project's Playwright server and tsc, Defender, WMI): e2e failed 3 unrelated
  heading checks with default workers; `--workers=2` all 57 green. If local e2e flakes again, check machine load first.
- Codex on PR #76: no findings.

## #18 App Store header, search results and universal images — done (PR #79)

- Core: `creative.json` (background, phrase per locale up to 60), `creativeLayout` / `renderCreativeAsset` (key art in
  the safe area, fading row of same-size devices outside), `generateCreativeAssets` (header 3840×1646, search
  3840×2560 via new catalogue `defaultSize`, universal 5244×2950), preview with safe area; `/api/catalogue` serves
  `creativeImages` and `maxPhrase`.
- librsvg's feDropShadow took 22 s for the universal image → shadow pre-blurred by sharp at quarter size (ms).
  First composition (one huge device per side) looked wrong in the render → row of same-size devices fading out.
- UI: purpose "header" enabled; new `LocaleTextFields` (also Logo taglines); `PreviewCard.guide` (dashed overlay).
- Reviews: code-review 8, design-critic 5, security 0. Follow-up `useAutosave` noted on #64.
- Bash heredocs with apostrophes failed again for long OpenSpec files → Write tool.
- Codex on PR #78: no findings.

## #19 Play feature graphic and in-app event images — done (PR #80)

- Generator groups `header` / `feature`; feature = Play feature graphic (phrase) + App Store event card 3840×2160 and
  details 2160×3840 (no text, new catalogue `defaultSize`), centred key areas (`keyArea` shares), enabled stores only.
- `creativeLayout(…, textWidth)` centres phrase + key device (also improves #18 images); text-free images rendered
  once per screenshot set and shared across languages.
- UI: purpose "Feature graphic and in-app event images" shares background and phrases; phrase fields only when a text
  image exists; "Show key area".
- Mistake: `npx prettier --write` reformatted ScreenshotsPage (project has no Prettier) → restored and re-applied.
  Never run formatters the project does not use.
- Deferred: max media height on PreviewCard for the 9:16 event details card (component-architect first).
- Codex on PR #79: no findings.

## #30 Review findings from #29 — done (PR #82)

- iPad preview entry split: `apple.preview.ipad-12.9` (1200×1600, 900×1200) and `apple.preview.ipad-9.7` (900×1200).
- `resolveLocales` validates entries before expanding "all"; code review found the same early "all" return in
  `selectExportLocales` → fixed. Generators expand "all" to all catalogue locales instead of project locales → #81
  (Backlog, P2/S).
- Codex on PR #80: no findings.

## #15 AI job folder contract and watcher — done (PR #83)

- `src/core/jobs/`: `createJob` (brief, claims, images, ffmpeg frames via execFile, JSON Schemas from zod), `readJob`
  (all-or-nothing validation, forbidden claims, warnings), `applyHeadlines` (from the current effective set, only
  texts change; `applied.json` with a hash of headlines.json), `listJobs(limit)`.
- Server: `/api/jobs`, `/api/jobs/:id`, `/apply`, `/api/jobs/events` (SSE from a debounced recursive fs.watch, error
  handler). UI: `AiJobPanel`, `CommandBox`, `HeadlineVariantsCard` in the Screenshots preview step.
- Code review found real apply bugs (dropped slots, lost overrides, reverted edits) → fixed with tests.
- DaisyUI gotchas: `.mockup-code pre { width: max-content }` and `.list-row` column flow / `> * { grid-row-start: 1 }`.
- CodeQL flagged `byte % 36` (biased random) → `crypto.randomInt`.
- Bash heredocs with apostrophes / template literals failed twice → scripts via the Write tool.
- Codex on PR #82: no findings. Next: #16 (amc-copy skill), #24 (store texts).

## #84 Codex findings on #83 — done (PR #86)

- Edit lock during AI apply, released only after the reloaded sets render (effect), kept on reload failure; refused
  actions do not announce. `inspectJob` keeps the validated headlines fingerprint internal. Job refresh version
  counter. store-texts lstat guard with per-folder errors.
- Code review on the first fix found the lock timing and same-id stale fetches → fixed. Concurrent writers (second tab)
  → #85 (Backlog, P2/S).
- `gh project item-edit` right after `gh issue create` fails ("field-id must be provided" = empty item id): wait and
  look the item up by number.
- Next: #16 (amc-copy skill), #24 (store texts).

## #87 Codex finding on #86: lock recovery — done (PR #88)

- Edit lock redesigned in ScreenshotsPage: `applyRunning` + `lockedAfter` (reload number); numbered reloads drop late
  answers; every apply attempt reloads before edits; info line while locked; e2e with a failing GET after apply,
  recovery via upload (fails on old code).
- Two code-review rounds; root cause is the missing revision check on saves → #85, suggested P1 (Haluk to decide).
- CI flake: "Install Chromium" failed with apt exit 100 → `gh run rerun --failed` was enough.
- Codex on PR #86 led to this issue.

## #89 Codex finding on #88: cleanup after a failed save — done (PR #90)

- Failed flush before an AI apply cleans up in its own branch (busy, paused note, retries a waiting reload). E2E
  counts apply requests (0) and checks that edits work; fails on old code.
- Third lock fix in a row (#84, #87, #89) → #85 (revision check on saves) raised to P1 and Ready, before #16.
- Codex on PR #88 led to this issue.

## #85 Revision-checked saves for the screenshot sets — done (PR #91)

- `revision` in screenshots.json; serialized save per workspace with an optimistic check (409 + current sets); PUT
  requires a revision; `known` = stored ∪ page's known ∪ listed (unseen uploads still appended); AI apply retries.
- Page stamps saves with `knownRevision`; 409 → discard, reload, "changed elsewhere", callers continue; reload with a
  newer revision discards waiting edits, older ones are ignored. Save queue `discard()`.
- Code review found 10 points (stale edit after reload, double reader, known semantics, …) → fixed; security clean.
- The client edit lock from #84–#89 stays as a UX guard; data loss is now prevented by the server.
- Codex on PR #90: no findings. Next: #16 (amc-copy skill), #24 (store texts).

## #92 Codex findings on #91: queued saves on conflict — done (PR #93)

- Save queue: discard generations, `discardOn` (drop in the same step as the refused save — a caller's catch is too
  late, the next queued run starts in the next microtask), `SaveDiscardedError` for dropped flushes, `discard()`
  reports drops. Page: `isConflict`, reload with newer revision drops queued edits + refreshes previews, knownRevision
  never goes back.
- Codex on PR #91 led to this issue (P1). Next: #16 (amc-copy skill), #24 (store texts).

## #16 amc-copy skill (PR #94, merged)

- `skills/amc-copy/`: SKILL.md (job workflow), `references/copy-rules.md` (12 generic rules), `scripts/check.mjs`
  (no deps; exit 0 OK, 1 errors, 2 not a job folder). Forbidden claims from `claims.json` and `../../project.json`.
- Brief slots carry `layout` + `limits` (`COPY_LIMITS`: text-top 30/40, text-top-large 26/40, text-bottom 34/44);
  `limitsFor` falls back for older briefs. Tool warnings name the slot.
- `/code-review` 10 findings, all fixed. Next: #24 (store texts, P1 L).

## #24 Store texts (PR #95, merged)

- Catalogue `src/core/specs/texts.ts` (Apple keywords 100 bytes UTF-8; limits verified on developer.apple.com and
  support.google.com), `store-texts.json` with revision (broken file throws `StoreTextsFileError`, never overwritten),
  job task `store-texts` + skill `amc-store-texts` (humanizer Light adapted from ste80-humanizer, MIT notices),
  `GET /api/jobs?task=`, `applyJob` dispatch by brief task, export `<store>/store-texts/<store code>/NN-<field>.txt`.
- UI: generic `AiJobPanel`, `AiResultCard` (was HeadlineVariantsCard), `SaveStatus`, `StoreTextsCard`, TextField
  counter/messages (frame is a div now). Store texts e2e runs in the serial chain after logo.
- Reviews: code-review 10, design-critic 13 (fixed except a status badge per language), security clean.
- New: #96 shared hooks (P2 S, Backlog), #97 task-haluk confirm "no step bar" (P1 XS, sub-issue of #24).
- Lesson: node -e replacements inside bash double quotes eat backslashes and backticks; use a patch file.

## Backlog prioritised again (2026-11-19, delegated by Haluk)

- Ready: #81 and #96 (raised to P1), #98 (new, Codex on PR #95: pending saves when leaving a section, P1 S), #20, #21.
  #23 (Video UI) waits for #22 (amc-video). Rest stays in Backlog.

## #81 Project locales for "all" — done (PR #99)

- `selectProjectLocales(projectLocales, selection)` in `src/core/locales/`: export, generators, `createJob` and the
  card / creative previews use it; one message "is not a locale of this project"; malformed selection → 400.
- Code review 8 findings, 5 fixed (previews, wording, plural, type check); kept the per-caller try/catch.
- E2E: tests that wait 60–90 s for generation had the 30 s default test timeout → `test.slow()` (logo, screenshots ×3).
- Security review: no findings.

## #96 Shared hooks — done (PR #100)

- `src/web/hooks/useAiJob.ts` and `useRevisionAutosave.ts` (generic `load`/`documentOf` so Screenshots can load uploads
  with the sets; callbacks `onLoaded`, `onServerDocument`, `onChangedElsewhere`, `onSaved` via a ref set in
  useLayoutEffect; `applyLocked(apply)` keeps the #84/#87/#89 order). `isConflict`/`messagesOf` in `api.ts`.
- Code review 8 findings, 7 fixed (late first job list, stale save answer overwriting checks, unhandled apply error,
  render-time ref write, dead import, inline messagesOf copies, alias style). Creative autosave stays (no revision) →
  consider with #98.
- One e2e flake: "header image preview at 768 px" failed once under load, green in two reruns. Watch.
- No delta spec (`skip_specs`), no design-critic (no visible change), no security review (client only).

## #98 Pending saves when leaving a section — done (PR #102)

- Codex finding on PR #95. `src/web/lib/pending-saves.ts` (track / settled max 10 s / reportSaved / subscribe); the
  autosave hook (`section` option, conflict on leave → `DroppedSaveError`, no reload), Logo and creative settings track
  their unmount flush; first loads and the Export checklist wait for `settled()` (cancelled when the page is gone).
- App shows lost edits in one mounted `role="alert"` (StatusAlert error / warning for a conflict, link button back,
  Dismiss); stays until dismissed or a later save there works.
- design-critic 5 (4 applied; message below the page heading needs a PageHeader slot), code review 7 (5 fixed).
  New #101 (Backlog, P2 S): shared plain autosave hook for Logo and creative settings.
- `src/web/lib` files imported by unit tests need `.js` in their own relative imports (tsconfig.test is nodenext).
- E2E took 8.7 min locally under load; CI Playwright 6 min.

## #103 Lost edits per document (Codex on #102) — done (PR #104)

- Codex P2 on PR #102: the creative settings save cleared the loss of the screenshot sets (same section). Taken right
  away (lost-data message). `SaveSource` = section + document; `withOutcome` / `lostSections` pure and tested; a no-op
  save returns the same array (code review: avoids an App re-render on every autosave).

## #20 App Store preview video pipeline — done (PR #105)

- `src/core/video/` (tools, probe, preview), `generateStorePreviews` + `renderPreviewFrame`, `src/server/video-routes.ts`
  (`GET /api/video/tools`, `POST /api/generate/store-previews`, `GET /api/video/frame`). Checklist measures videos
  with ffprobe (warning without it). `RegisterOptions.sourceFile` copies large files instead of holding bytes.
- Decisions: pad never crop (bars in card colour), CBR 11 Mbps (`nal-hrd=cbr`), preset veryfast, cards keep their
  length and the recording is cut, < 15 s is an error; poster frame is set in App Store Connect, the frame route helps
  choose it; `-protocol_whitelist file` on workspace inputs (security hardening).
- Code review 10 findings, all fixed; security review clean. CI now installs ffmpeg (apt); the 16 video tests ran in
  CI in 45 s, locally ~170 s under load.
- Heredocs with apostrophes failed again for the OpenSpec files → Write tool (keep doing that).
- Next Ready: #21 (embed / loop videos, builds on this). #23 (Video UI) waits for #22 (amc-video skill).

## #106 ffprobe lookup for wrapper names (Codex on #105) — done (PR #107)

- Codex P2 on PR #105: a `FFMPEG_PATH` without an `ffmpeg` file name made ffmpeg itself the ffprobe. Taken right away
  (shared video tools). Sibling only for `ffmpeg…` names, otherwise PATH. Code review: no findings.

## #21 Device videos and looping header / search videos — done (PR #108)

- Catalogue `web.video.vertical|landscape|square` (group `video`, unverified). `frameOverlaySvg` + `keyScreen`
  (frame with the screen cut out); `src/core/video/compose.ts` (layout, layers, `planLoop` crossfade, `planClip`,
  `composeArgs`); `generateEmbedVideos` / `generateLoopVideos`; `recordings.ts` shared with the store previews.
- Layer trick: plate → recording in the screen → overlay. Device videos use the whole plate with the rounded screen
  cut out as overlay (hides corners also with frame `none`). Loop: `xfade` of the clip's first 0.5 s over its last.
- Code review 10, all fixed; security clean. Seamless test: the last→first jump is compared with an ordinary frame
  step (testsrc2 changes every pixel each frame, so "first vs middle" was no baseline). 4K loop renders are slow under
  load: the loop test runs one language (tr-TR), German is covered by the device video test.
- Next: no Ready issue left; #23 (Video UI) waits for #22 (amc-video skill, Backlog).

## #101 Shared plain autosave — done (PR #109)

- `useAutosave` (core: queue, debounce, flush, discard, tracked save on leaving, reportSaved, discardOn / onDropped)
  and `useLoadAfterSaves`; `useRevisionAutosave`, Logo settings and creative settings build on them. Circular
  reload ↔ autosave dependency solved with a ref set in useLayoutEffect. Code review 7 (6 fixed; no hook unit tests
  without a DOM setup — e2e covers #84–#98). No visible change.

## #23 Video section UI — done (PR #110)

- `VideoPage` (Upload → Purpose → Options → Export), `video.json` settings via `useAutosave`, MP4 from
  `/api/output/file` with byte ranges, `catalogue.videos`; reuse `useOutputStatuses`, `lib/frames.ts`, TextField
  `inputMode`; generic `SectionPage` removed. CI e2e job installs ffmpeg.
- Decisions: step 3 "Options" (no instant video preview); one generate request for all selected languages (keeps the
  generators' encode-once); sizes / lengths only from the catalogue.
- Reviews: architect (no new component), design-critic 8 (7 applied), code review 10 (9 fixed), security clean.
- Mistakes: nested `<li>` (PreviewCard is the list item itself) caught by axe; node -e with template literals failed
  twice again → Write / Edit tools only.
- Under 100 % CPU a full local run timed out twice (render test, logo e2e); green alone and on rerun.
- M5 is done except #22 (promo reels, Backlog: needs Haluk's decision on the engine).

## Session 2026-11-20: Haluk's go for the small items and #22

- Decisions: #22 engine is brag (HyperFrames); #97 confirmed (Store texts without a step bar), closed.
- Ready: #42, #47, #64, #77 (S), then #22 (L).

## #111 Video texts of removed languages and real video sizes (Codex on #110) — done (PR #112)

- `videoRequestBody` keeps only the requested languages' texts; result cards read `videoWidth` / `videoHeight`.
  Code review: no findings.

## #42 Expo / React Native icons — done (PR #113)

- `src/core/specs/expo.ts` (Expo docs checked 2026-11-20 via web-fetch: keys, 1024, opaque square iOS icon; dark,
  tinted and Android layers unverified), `generateExpoIcons`, logo pack `expo` (opt-in), `docs/expo-icons.md`.
- Code review 8 (7 fixed), design-critic 2 (applied). Shared `renderIosAppearances` with the App Store pack.

## #47 Stream the Export ZIP to disk — done (PR #114)

- `POST /api/export/prepare` + `GET /api/export/download?token=` (192-bit tokens, valid 10 min for retries, never
  fetched ZIPs removed on expiry); `createExport` honours an AbortSignal (closes the #48 follow-up).
- Code review 8 (all fixed), security clean. CI: `apt-get install ffmpeg` took 10 min on this PR → #115 (P2 S, Ready).
