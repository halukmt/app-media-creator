# app-media-creator

Turn a **logo, screenshots and a video** into every media asset your app needs for the
**Apple App Store**, **Google Play** and the **web** — in six languages, from one local tool.

> **Status: early development (pre-0.1.0).** The project setup is done; features are built milestone by
> milestone (see [Roadmap](#roadmap)). Nothing is published to npm yet.

## What it will generate

| Input | Output |
|---|---|
| **Logo** | App Store icon 1024 (+ dark / tinted, layer-ready files for Icon Composer), Google Play icon 512 and adaptive icon layers with mipmaps, favicon set and `site.webmanifest`, Open Graph / X / WhatsApp previews, social profile and banner sizes, monochrome and inverse variants, and labelled icon variants for preview and test installs ([docs](docs/icon-variants.md)) |
| **Screenshots** | Store screenshots with headline card, background and device frame (3 layouts) — or frame-only images for your website; all iPhone (incl. iPhone Duo), iPad and Android phone / tablet sizes; App Store product page header and search result assets; Google Play feature graphic |
| **Video, URL or repo** | App Store app previews (886×1920, 15–30 s, spec-checked), looping header / search videos, promo reels for Google Play, web and social, or your video embedded in a styled background |
| **AI copy (optional)** | Screenshot headlines that tell a story, and store texts (name, subtitle, description, keywords …) ready to paste |

Every text-bearing asset is generated per language — one, several or all of:
German `de-DE`, English (US) `en-US`, Spanish `es-ES`, Italian `it-IT`, French `fr-FR`, Turkish `tr-TR`.
Everything downloads as one ZIP in a store-ready folder layout.

## How AI is used

AI is optional and never needs your credentials inside the tool:

- **Default:** the UI prepares a job folder; you run the bundled Claude Code skill in your editor, which uses
  your own Claude Code login. The UI picks up the results automatically.
- **Optional:** put an `ANTHROPIC_API_KEY` in `.env` to get a "Generate" button directly in the UI.

### Screenshot headlines with Claude Code

1. Install the skill once in the project that uses app-media-creator:

   ```bash
   npx skills add halukmt/app-media-creator --skill amc-copy
   ```

2. In the Screenshots section, open **Preview and edit** and choose **Prepare AI job** for the selected languages.
3. Copy the command exactly as the page shows it (for example
   `/amc-copy "/path/to/your-app/.app-media/jobs/20261119-104512-k3x9"`, with the full path) and run it in Claude Code. The skill looks at your screenshots, follows the copy rules and your `claims` (allowed and forbidden),
   and writes two variants per language: **A** outcome-first and **B** mechanism-first.
4. The page shows the result as soon as the skill has written it. Compare A and B and apply one; nothing changes
   before you do. Results that break the rules (for example a forbidden claim) are shown as errors and never applied.

## Requirements

- Node.js ≥ 22.12
- ffmpeg on `PATH` (or `FFMPEG_PATH` in `.env`) for video features

## Local development

```bash
npm install
cp .env.example .env   # optional
npm run dev            # API server on :4790 + UI on http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run dev` | Server (watch mode) and Vite UI together |
| `npm run build` | Build UI (`dist/web`) and server / CLI (`dist/`) |
| `npm start` | Run the built CLI (`app-media-creator`) |
| `npm run check` | TypeScript checks for server, UI and tests |
| `npm run check:all` | Project checks (component inventory, …) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests with accessibility checks (Playwright + axe) |
| `npm run check:release` | Release gate: CHANGELOG version equals `package.json`, no `[Unreleased]` entries |

CLI options: `app-media-creator --port <n> --no-open --version --help`.

## Roadmap

| Milestone | Content |
|---|---|
| M0 | Project setup (this) |
| M1 | Core, app shell, locale settings, logo pack |
| M2 | Screenshots: card mode, frame-only mode, all devices, per-locale sets |
| M3 | AI copy: headline storytelling, job folder, Claude Code skill |
| M4 | App Store header / search result assets, Play feature graphic, in-app event media |
| M5 | Video: store previews, looping header video, promo reels (HyperFrames or hype-reel) |
| M6 | Store texts for all locales |
| M7 | First release 0.1.0, npm package, public repo |

## How we work

- Every requirement is a GitHub issue in the project board, with `size:*`, `prio:*` and `enhancement` / `bug` labels.
- Implementation is planned with [OpenSpec](https://github.com/Fission-AI/OpenSpec) in
  `openspec/changes/<issue>-<slug>/`.
- Feature branches merge into `dev` via PR; releases go from `dev` to `main`.
- Changes are recorded in [CHANGELOG.md](CHANGELOG.md) ([Keep a Changelog](https://keepachangelog.com/en/1.1.0/), SemVer).
- Rules for contributors and AI agents: [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Licence

[MIT](LICENSE). Store specifications are summarized from Apple and Google documentation; Apple device bezels
and badges are **not** included and must be downloaded from Apple by each user.
