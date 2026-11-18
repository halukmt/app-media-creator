# app-media-creator — Project Setup and Product Plan


## Context

The repo `c:\zdev\05 Tools\app-media-creator` holds a small static React/Babel prototype
(branded for one app) that renders App Store screenshot cards (headline + background +
phone frame, 3 layouts, colour presets) and translates metadata. There is no git repo,
no package.json, no tests.

Goal: turn it into a public, MIT-licensed tool that takes a **logo, screenshots and a
video (or a website / repo URL)** and produces every media asset needed for the
**Apple App Store, Google Play and web/social** — and run the project with the same
"operating system" as `C:\zdev\02 Produkte\ki-mal-mit` (OpenSpec, GitHub issues +
Project, `/loop /next-issue`, README, CHANGELOG).

Decisions already taken with Haluk:

| Topic | Decision |
|---|---|
| Language | Everything English (docs, issues, OpenSpec, changelog, UI). Chat stays German. |
| Distribution | npm CLI (`npx app-media-creator`) + bundled Claude Code skills (`npx skills add`) |
| Prototype | Rebuild from scratch; old files move to `legacy/` as visual reference |
| AI access | Default: job folder + Claude Code skill (user's own subscription). Optional: `ANTHROPIC_API_KEY` in `.env` enables an in-UI "Generate" button. No `claude -p` spawning. |
| Promo video engine | Both selectable: HyperFrames/brag and hype-reel |
| Store preview video | Own plain ffmpeg pipeline (Apple allows only real app footage) |
| Visibility | Private repo first, public at the first release (v0.1.0) after a licence/secret check |
| Media languages | All generated media in 6 languages: German, US English, Spanish, Italian, French, Turkish. Generate one, several or all at once. (Added 2026-11-18) |

## Localization (cross-cutting, applies to every milestone)

Every asset with text or text-dependent content (screenshot cards, creative assets, feature graphic,
OG images with a tagline, video text cards and captions, store texts) is generated **per locale**.
Assets without text (icons, favicons, frame-only screenshots without overlay) are generated once and
shared by all locales.

| Language | Folder / project locale | App Store Connect | Google Play |
|---|---|---|---|
| German | `de-DE` | `de-DE` | `de-DE` |
| English (US) | `en-US` | `en-US` | `en-US` |
| Spanish | `es-ES` | `es-ES` | `es-ES` |
| Italian | `it-IT` | `it` | `it-IT` |
| French | `fr-FR` | `fr-FR` | `fr-FR` |
| Turkish | `tr-TR` | `tr` | `tr-TR` |

Source: the App Store Connect locale mapping and the 6-language screenshot set of an existing app of the maintainer.

- **Catalogue:** `src/core/locales/` holds the 6 locales with their store codes; the list is data, so more
  languages can be added later without code changes.
- **Project setting:** source language + selected target locales (default all 6). UI offers "this language",
  a multi-select and "all languages" for every generate/export action.
- **Inputs per locale:** screenshots and videos can be uploaded per locale (localized app UI); when a locale has
  no own input, the source-language input is used and the asset is flagged "fallback input" in the export checklist.
- **Copy:** the AI writes headlines and store texts per locale following "localize, don't translate"
  (same facts, native phrasing). Users can edit every locale; edits are never overwritten without confirmation.
- **Text fitting:** card layouts auto-shrink and wrap per locale (German and Turkish run long); the validator
  warns when text overflows or exceeds the store's character limits.
- **Export layout:** `output/<target>/<locale>/<device>/NN-name.png`, store texts in
  `output/store-texts/<locale>/NN-field.txt`; ZIP for one locale or all.
- **Tests:** every renderer test runs at least for `de-DE` and `tr-TR` (long words, special characters ç ğ ı İ ş ü).

Pattern worth reusing in M2: render 6-language App Store screenshots from the app itself with Playwright
(deterministic seed data, drawn status bar).

## Research findings that shape the design

- **Apple screenshots:** 1–10 per size, PNG/JPEG without alpha. Required: iPhone 6.3"
  (1179×2556 / 1206×2622) or the large classes (6.9": 1290×2796 / 1320×2868; 6.5":
  1284×2778 / 1242×2688); iPad 13" (2064×2752) if the app runs on iPad.
  **iPhone Duo** (outer 1398×2034, inner 2007×2853) optional now, required from April 2027.
- **Apple app previews:** up to 3 per size, 15–30 s, ≤500 MB, H.264 ≤30 fps, stereo AAC;
  886×1920 (iPhone), 1200×1600 (iPad). Duo preview sizing is an open Apple issue → flag as experimental.
- **Apple creative assets ("moving backgrounds"):** product page header 3840×1646 (21:9,
  PNG or 5–30 s looping video), search results 3:2 (1920×1280–3840×2560, image or video),
  universal 5244×2950 PNG; each with an art safe area. In-app event card 16:9 and details 9:16.
- **Apple icon:** 1024×1024 square, unmasked, opaque; dark / tinted variants; Icon Composer
  needs separate layer files (we export layer-ready SVG/PNG, not the `.icon` file).
- **Google Play:** icon 512×512 PNG, feature graphic 1024×500, phone screenshots 2–8
  (1080×1920 recommended), tablet 7"/10" (16:9 / 9:16), promo video = YouTube URL,
  adaptive icon layers 108 dp with 66 dp safe zone, mipmap densities. Play discourages
  device frames and limits overlay text to <20 % → Play preset defaults to "no frame" with a warning.
- **Device frames:** Apple's official bezels may not be redistributed or modified. Ship our own
  generic neutral frames (SVG) and let users drop official bezels into a local `frames/` folder.
- **Web/social logo pack:** favicon.ico, icon.svg, apple-touch-icon 180, manifest 192/512,
  maskable 512, OG 1200×630, X card, WhatsApp-safe preview (<300 KB), social profile/banner sizes.
- **Strategy (store listing review of an existing app):** screenshots 1–3 must tell an outcome story on their
  own; one idea per screenshot; headline must match what is visible; no unprovable claims,
  prices, superlatives; per-project allowed/forbidden claims; localise, don't translate;
  produce variant A (outcome-first) and B (mechanism-first) for product page optimisation.
- **Licences:** brag MIT, HyperFrames Apache-2.0, hype-reel MIT, ste80-humanizer MIT → usable
  with notices. Remotion, video-studio-kit, remotion-dev/skills → not bundled. Bundled music
  only with a clear licence; v1 ships none (user supplies audio, otherwise a silent stereo track).

## Architecture

Single TypeScript npm package, Node ≥ 22.

```
src/core/      pure Node library: specs catalogue, renderers, zip — no UI, fully testable
  specs/       typed catalogue of every target/device/asset (the tables above) — single source
  logo/        sharp + resvg: icon packs, favicons, adaptive icon layers, social sizes
  screenshots/ satori + resvg: card templates (3 layouts), frame-only mode, creative assets
  video/       ffmpeg (system binary or optional ffmpeg-static): store preview, embed-in-background,
               looping header/search video, frame extraction for AI analysis
  copy/        job folder read/write, claims rules, optional Anthropic API client
src/server/    Hono: REST endpoints over core, uploads, file watcher on jobs/, serves built UI
src/web/       Vite + React + Tailwind 4 + DaisyUI 5 (theme variables only)
src/cli/       `app-media-creator` (start UI) + headless subcommands (logo, screenshots, video, export)
skills/        amc-copy (analyse + headlines + store texts), amc-video (HyperFrames | hype-reel)
frames/        own generic device frames (SVG); user-supplied bezels are gitignored
examples/      neutral demo project (no real app brand assets)
legacy/        old prototype, gitignored, local reference only
```

Key choices:
- **Rendering on the server** (satori → resvg → sharp), not `html-to-image` in the browser:
  exact pixel sizes, identical output from UI, CLI and skills. UI preview = same renderer at low resolution.
- **Workspace = a project folder** (`.app-media/` in the user's repo or a chosen directory) with
  `project.json`, `inputs/`, `jobs/<id>/`, `output/`. This is what makes the tool usable inside other repos.
- **AI job contract:** UI writes `jobs/<id>/brief.json`, `claims.json`, images and extracted video frames.
  The skill (or the API client) writes `headlines.json`, `store-texts/*.md`, `storyboard.json`. The server watches the folder and the UI updates.
- **Background colours:** preset swatches plus colours extracted from the uploaded logo. No free colour picker, no theme picker.

### UI (best practice for a multi-asset tool: project studio with guided steps)

DaisyUI app shell: `drawer lg:drawer-open` sidebar + main area. Sidebar sections:
**Project → Logo → Screenshots → Video → Store texts → Export.**
- *Project:* name, targets (App Store / Google Play / Web), device models per target
  (iPhone, iPhone Duo, iPad; Android phone, tablet 7"/10"), locales, allowed/forbidden claims.
- Each asset section runs the same `steps` flow: **Upload → Purpose/Options → Preview & edit → Export**.
- *Screenshots — Purpose* asks what the upload is for: store screenshots with card (text + background + frame),
  frame only (for the app website), header / search-results creative asset, Play feature graphic.
- *Export:* checklist of all generated assets per target with spec validation (size, alpha, count, duration) and one ZIP
  in a store-ready folder layout; store texts numbered in paste order.

## Milestones (become GitHub issues; M0–M2 go to "Ready", the rest to "Backlog")

- **M0 — Project operating system** (details below)
- **M1 — Core + app shell + Logo pack:** specs catalogue, **locale catalogue (6 languages) and project locale
  settings with "one / several / all" selection**, workspace, upload, logo → App Store icon (+dark/tinted,
  layer-ready files), Play icon + adaptive layers + mipmaps, favicon/PWA set + `site.webmanifest`, OG/X/WhatsApp
  (OG/X images with tagline per locale), social profile/banner sizes, monochrome/inverse variants, ZIP.
- **M2 — Screenshots:** card mode (3 layouts ported from `legacy/canvas.jsx` and `legacy/app.jsx`), frame-only mode
  (transparent PNG/WebP for web), device/target selection incl. iPhone Duo and iPad, **screenshot uploads per locale
  with source-language fallback, headlines per locale, text fitting for long languages**, validation,
  ZIP per locale or all.
- **M3 — AI copy:** job folder contract, `amc-copy` skill with the storytelling rules and claims list, variants A/B,
  **localized headlines for all selected locales in one run (localize, don't translate)**, optional API-key path,
  humanizer pass (ste80-humanizer, light mode) on longer texts.
- **M4 — Creative assets:** header / search-results / universal images with safe-area guides, Play feature graphic,
  in-app event card and details images, **each with its localized phrase per locale**.
- **M5 — Video:** store preview pipeline (scale/pad, text cards, fades, silent stereo track, spec check),
  embed-in-background export, looping header/search video, `amc-video` skill with engine choice
  (HyperFrames | hype-reel) for inputs video / URL / repo / screenshots, Play promo (YouTube-ready 16:9 / 9:16),
  **video text cards and captions rendered per locale, batch render for all selected locales**.
- **M6 — Store texts:** name, subtitle, promo text, description, keywords, what's new (App Store) and short/full
  description (Play), **for all 6 locales with the correct store codes (`it`, `tr` for App Store Connect)**,
  character-limit checks, ZIP in paste order. (Marked optional by Haluk.)
- **M7 — Release:** npm publish workflow, skills install docs, THIRD_PARTY_NOTICES, licence/secret audit,
  switch repo to public, v0.1.0.

## M0 — Project operating system (replicates ki-mal-mit, in English)

Reference files to adapt (read, then rewrite in English for this stack):
`C:\zdev\02 Produkte\ki-mal-mit\.claude\skills\next-issue\SKILL.md`, `.claude\skills\release\SKILL.md`,
`.claude\agents\{component-architect,design-critic}.md`, `.claude\hooks\ui-workflow-guard.cjs`,
`.claude\rules\{components,testing}.md`, `.claude\settings.json`, `openspec\config.yaml`,
`.github\ISSUE_TEMPLATE\*`, `.github\pull_request_template.md`, `.github\workflows\{ci,release}.yml`,
`.github\dependabot.yml`, `CHANGELOG.md`, `.gitignore`, `.gitattributes`.

1. Move prototype files to `legacy/`; `git init`; `.gitignore`, `.gitattributes`, `LICENSE` (MIT),
   `README.md`, `CHANGELOG.md` (Keep a Changelog, SemVer, `[Unreleased]`), `.env.example` (`ANTHROPIC_API_KEY`, optional).
2. Scaffold package: `package.json` (bin, scripts `dev`, `build`, `check`, `test`, `test:e2e`, `check:all`),
   TypeScript strict, Vite, Tailwind 4 + DaisyUI 5, Vitest, Playwright.
3. Instructions: rewrite `.github/copilot-instructions.md` as the single source of rules; root `CLAUDE.md`
   with `@.github/copilot-instructions.md` (replace the current `.claude/CLAUDE.md`).
4. `.claude/`: `settings.json` (allow `gh issue|project|pr|label|run`, `openspec`; deny push to main, force push, `.env`),
   UI guard hook, rules, agents `component-architect` + `design-critic`, skills `next-issue` + `release`,
   `daisyui` skill via `npx skills add saadeghi/daisyui`, `skills-lock.json` + `skills/SOURCES.md`,
   `src/web/components/INVENTORY.md` + `check:inventory`.
5. OpenSpec: `openspec init --tools claude` (1.13.2), English `config.yaml` with the same rules
   (change folder `<issue>-<slug>`, proposal starts with `Issue: #<n>`, WHEN/THEN scenarios, review log, final check group).
6. GitHub (outward-facing — confirm before running): create **private** repo `halukmt/app-media-creator`,
   branches `main` + `dev` (dev default), labels (`size:*`, `prio:*`, `enhancement`, `bug`, `design`, `infra`, `video`,
   `needs-input`, `needs-decision`, `task-haluk`, `dependencies`), new GitHub Project with Status
   (Backlog, Ready, In progress, In review, Done, Released), Priority, Size; issue + PR templates.
7. Workflows: `ci.yml` (check, check:all, unit, build, e2e, gitleaks; docs-only skip), `release.yml` (tag + GitHub release
   from CHANGELOG; npm publish added in M7), `dependabot.yml`. No deploy workflow (local tool).
8. Create the milestone issues M1–M7 (split into issues of size ≤ L) in the Project with labels and fields.
9. Then development runs through `/loop /next-issue` (never merges to main; releases only via `/release`).

`next-issue` differences from the reference: no d1 deploy steps, no Codex collection issue, local check =
`npm run build && npm run check && npm run check:all && npm test && npm run test:e2e`.

## Verification

- **M0:** `npm run build`, `npm run check`, `npm test` pass on a clean clone; `openspec validate` passes;
  `gh project item-list` shows the issues with Status/Priority/Size; CI green on the first PR to `dev`;
  `/next-issue` dry run picks the highest-priority Ready issue.
- **Core (M1+):** Vitest checks every generated file against the specs catalogue (dimensions, format, alpha, file size,
  duration/fps/audio via `ffprobe`); golden-image tests for the three card layouts.
- **UI:** Playwright end-to-end with the `examples/` project: upload logo + screenshots → export ZIP → unzip and assert
  the file list per target; axe accessibility check; screenshots at 375 / 768 / 1280 px.
- **Real-world check:** generate the set for a real app (local, not committed) and upload to App Store Connect
  (screenshots, header asset, preview) and Play Console to confirm acceptance.

## Open points / risks

- iPhone Duo preview sizing unresolved on Apple's side → export marked experimental.
- Apple featuring artwork specs and several social sizes are unverified → catalogue entries carry a `verified` flag.
- ffmpeg must be installed (or optional `ffmpeg-static`); video features degrade gracefully without it.
- hype-reel loads React/Framer Motion from a CDN at render time and needs Chrome/Python → documented as optional engine.
- Session memory folder still points to the old directory name `appstore-media`.
