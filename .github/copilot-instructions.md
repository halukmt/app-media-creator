# app-media-creator — Project Instructions

Single source of project rules for AI agents (GitHub Copilot and Claude Code via `CLAUDE.md`).
Do not repeat these rules in other files; link here instead.

## 1. Project

- **What:** a local tool that turns a **logo, screenshots and a video** (or a website / repo URL) into every
  media asset needed for the **Apple App Store, Google Play and the web/social**: icon and logo packs,
  framed screenshots with headline cards, frame-only screenshots, product page header and search result
  assets, feature graphics, app preview and promo videos, and store texts.
- **Languages of generated media:** German `de-DE`, English (US) `en-US`, Spanish `es-ES`, Italian `it-IT`,
  French `fr-FR`, Turkish `tr-TR`. Users generate one, several or all at once. App Store Connect uses `it` and
  `tr` for Italian and Turkish. Text-free assets are generated once and shared by all locales.
- **Who:** app developers who want store-ready media without design tools. Public, MIT-licensed, installable
  into other repos (`npx app-media-creator` + Claude Code skills).
- **Plan and research:** `.claude/plans/2026-11-18_app-media-creator-setup.md`,
  `.claude/research/` (store specs, video tools, copy rules). The specs research is the source for `src/core/specs/`.
- **Legacy prototype:** `legacy/` (static React/Babel, visual reference only). Gitignored and local only:
  it exists on Haluk's machine, not in clones or CI. Never commit it; port ideas, not files or brand assets.

## 2. Language rule

- **English** for everything in this repo: code, comments, docs, README, CHANGELOG, OpenSpec artifacts,
  issues, PRs, commit messages and UI text.
- Chat with Haluk is German.

## 3. Tech stack

| Area | Choice |
|---|---|
| Runtime | Node ≥ 22.12, ESM, TypeScript strict (`tsconfig.base.json`) |
| Core library | `src/core/` — pure Node, no UI, fully unit-tested (renderers, specs catalogue, locales, zip) |
| Server | `src/server/` — Hono on `@hono/node-server`, JSON API under `/api`, serves `dist/web` |
| CLI | `src/cli/` — `app-media-creator` starts the server and opens the browser |
| UI | `src/web/` — Vite + React + Tailwind 4 + DaisyUI 5 |
| Image rendering | Server side (satori → resvg → sharp), never in the browser, so UI, CLI and skills give identical pixels |
| Video | ffmpeg (system binary, `FFMPEG_PATH`); promo engines HyperFrames/brag and hype-reel via skills |
| AI | Default: job folder + Claude Code skill run by the user; optional `ANTHROPIC_API_KEY`. Never spawn `claude -p` from the server |
| Tests | Vitest (`tests/unit/`), Playwright + axe (`tests/e2e/`) |

Commands: `npm run dev` (server + Vite), `npm run build`, `npm run check` (types), `npm run check:all`
(project checks), `npm test`, `npm run test:e2e`, `npm start` (built CLI).

## 4. STOP: before any UI work

Before creating or changing files in `src/web/components/`, `src/web/layouts/` or `src/web/pages/`:

1. Run the agent **`component-architect`** (reuse map).
2. Load the skill **`daisyui`**.
3. Reuse order: existing component → wrap one DaisyUI component once → new component.
4. New components are decided by Claude (do not wait for Haluk), added to `src/web/components/INVENTORY.md`
   with reason and rejected alternative **before** the file exists.
5. Mark `needs-decision` only for design questions with high impact (overall layout, navigation).

The hook `.claude/hooks/ui-workflow-guard.cjs` blocks UI writes until steps 1 and 2 ran in the session.
Details: `.claude/rules/components.md`.

## 5. Workflow: issues and OpenSpec

- Every requirement starts as a GitHub issue in the project **"app-media-creator"** (user project 10 of `halukmt`, https://github.com/users/halukmt/projects/10).
  The issue says *what*; `openspec/changes/<issue>-<slug>/` says *how*.
- Branches: `feat/<issue>-<slug>` or `fix/<issue>-<slug>` from `dev`. PR to `dev` with title `#<issue> <title>`
  and `Closes #<issue>` in the body. Squash merge.
- The loop `/loop /next-issue` implements one Ready issue per run. It never merges or pushes to `main`.
- **Issue rules:**
  - Add every issue to the project.
  - Exactly one `size:*` label, exactly one `prio:*` label, exactly one of `enhancement` or `bug`;
    set the project fields Priority and Size to match.
  - Optional labels: `design`, `infra`, `video`, `i18n`, `ai`, `docs`, `dependencies`.
  - Media issues state which locales they cover (default: all 6).
  - `needs-input`: waits for material or approval from Haluk; the loop skips it.
  - `needs-decision`: a decision is needed; the loop stops.
  - `task-haluk`: a task for Haluk (XS, same priority as the blocked issue, assigned to halukmt, status Backlog,
    sub-issue of the blocked issue, checklist plus "Blocks #<n>"). Open points never live only in chat.
  - Status flow: Backlog → Ready → In progress → In review → Done (on `dev`) → Released (on `main`).
- Commits: `feat(#<n>): <description>`, `fix(#<n>): …`, `chore(#<n>): …`, `chore(release): vX.Y.Z`.

## 6. CHANGELOG and releases

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and SemVer. Every merge to `dev` adds one line under
  `[Unreleased]` (Added / Changed / Fixed / Removed / Security) ending with `(#<n>)`.
- Releases only via `/release` (dev → main, merge commit). `release.yml` creates tag and GitHub release.
- The repo stays private until v0.1.0; the release before going public includes a licence, secret and
  private-content audit (no app-specific strategy, private repo content or third-party brand assets).

## 7. Generated media rules

- `src/core/specs/` is the single source of sizes, formats and limits. Every entry carries `verified: true|false`
  and a source URL. Never hard-code a store size elsewhere.
- Every generated file is validated against its spec (dimensions, alpha, format, file size, duration, fps, audio).
- No Apple bezels, badges or other third-party artwork in the repo. Generic frames live in `frames/`;
  users put official bezels into `frames/user/` (gitignored).
- Google Play screenshots default to "no device frame" and warn when overlay text exceeds 20 % of the image.
- AI copy follows the rules in `.claude/research/2026-11-18_strategy-and-copy-rules.md` and the project's `claims.json`.

## 8. Quality

- TypeScript strict, no `any` without a comment. Pure functions in `src/core/`, side effects at the edges.
- Tests per `.claude/rules/testing.md`. Renderer tests run at least for `de-DE` and `tr-TR`.
- UI: mobile first (375 px), DaisyUI theme variables only, no hex colours, axe without serious/critical issues.
- No third-party network requests from the UI at runtime. No telemetry.
- Third-party code only with a compatible licence (MIT, Apache-2.0, BSD, ISC) and an entry in `THIRD_PARTY_NOTICES.md`.
  Not allowed: Remotion, unlicensed repos, AGPL.

## 9. Secrets

- `.env` is local only and never read by agents. `.env.example` lists every variable with a comment.
- The only secret is the optional `ANTHROPIC_API_KEY`.

## 10. Sessions

- Handoff notes: `.claude/sessions/YYYY-MM-DD_<topic>.md`; read the newest one at session start.
- Plans: `.claude/plans/YYYY-MM-DD_<topic>.md`.
