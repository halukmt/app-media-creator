# app-media-creator

Turn a **logo, screenshots and a video** into every media asset your app needs for the
**Apple App Store**, **Google Play** and the **web** — in six languages, from one local tool.

> **Status: early development (pre-0.1.0).** The project setup is done; features are built milestone by
> milestone (see [Roadmap](#roadmap)). Nothing is published to npm yet.

## What it will generate

| Input | Output |
|---|---|
| **Logo** | App Store icon 1024 (+ dark / tinted, layer-ready files for Icon Composer), Google Play icon 512 and adaptive icon layers with mipmaps, favicon set and `site.webmanifest`, Open Graph / X / WhatsApp previews, social profile and banner sizes, monochrome and inverse variants, labelled icon variants for preview and test installs ([docs](docs/icon-variants.md)), and Expo / React Native icons with their `app.json` lines ([docs](docs/expo-icons.md)) |
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

### Store texts with Claude Code

1. Install the skill once: │
●   claude-code_2-1-327_agent  Agent detected — installing non-interactively
[?25l│
◇  Source: https://github.com/halukmt/app-media-creator.git
[?25h[?25l│
◒  Cloning repository…[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository…[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository….[1G[J◐  Cloning repository….[1G[J◓  Cloning repository….[1G[J◑  Cloning repository….[1G[J◒  Cloning repository….[1G[J◐  Cloning repository….[1G[J◓  Cloning repository….[1G[J◑  Cloning repository….[1G[J◒  Cloning repository…..[1G[J◐  Cloning repository…..[1G[J◓  Cloning repository…..[1G[J◑  Cloning repository…..[1G[J◒  Cloning repository…..[1G[J◐  Cloning repository…..[1G[J◓  Cloning repository…..[1G[J◑  Cloning repository…..[1G[J◒  Cloning repository…...[1G[J◐  Cloning repository…...[1G[J◓  Cloning repository…...[1G[J◑  Cloning repository…...[1G[J◒  Cloning repository…...[1G[J◐  Cloning repository…...[1G[J◓  Cloning repository…...[1G[J◑  Cloning repository…...[1G[J◒  Cloning repository…...[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository…[1G[J◐  Cloning repository…[1G[J◓  Cloning repository…[1G[J◑  Cloning repository…[1G[J◒  Cloning repository…[1G[J◐  Cloning repository….[1G[J◓  Cloning repository….[1G[J◑  Cloning repository….[1G[J◒  Cloning repository….[1G[J◐  Cloning repository….[1G[J◓  Cloning repository….[1G[J◑  Cloning repository….[1G[J◒  Cloning repository….[1G[J◐  Cloning repository…..[1G[J◓  Cloning repository…..[1G[J◇  Repository cloned
[?25h[?25l│
[1G[J◒  Discovering skills…[1G[J◐  Discovering skills…[1G[J◓  Discovering skills…[1G[J◑  Discovering skills…[1G[J◒  Discovering skills…[1G[J◇  Found 13 skills
[?25h│
■  [SKILLS_NO_MATCHING_SKILLS] No matching skills found for: amc-store-texts│  ╰▶ fix: Available skills:
│    - amc-copy
│    - next-issue
│    - openspec-apply-change
│    - openspec-archive-change
│    - openspec-explore
│    - openspec-propose
│    - openspec-sync-specs
│    - openspec-update-change
│    - release
│    - daisyui-colors
│    - daisyui-config
│    - daisyui-install
│    - daisyui-usage.
2. In the Store texts section, choose the languages and **Prepare AI job**; run the command the page shows in Claude Code.
3. The skill learns what the app does (screenshots, current texts, your repo's README), writes name, subtitle,
   promotional text, description, keywords and what's new for the App Store and title, short and full description for
   Google Play, within each store's limits, and checks them. Keywords are researched per language, not translated.
4. The page shows the texts as soon as they are written; apply them, then edit any field. Counters show each field's
   limit (Apple keywords in bytes), and the export packs the texts per store and language in paste order.

## Requirements

- Node.js ≥ 22.12
- ffmpeg and ffprobe on `PATH` (or `FFMPEG_PATH` / `FFPROBE_PATH` in `.env`) for video features. Without them
  everything else works; video generation says what is missing, and the export checklist cannot measure videos.

### App Store preview videos

`POST /api/generate/store-previews` turns each uploaded screen recording (up to three per language) into App Store
previews: 886×1920 for iPhone (also used by iPhone Duo, experimental) and 1200×1600 for iPad when the project picked
an iPad size; a landscape recording gets the landscape size. The recording is trimmed (`trim`), padded to the store size
(never cropped), faded in and out and framed by optional text cards per language (`intro`, `outro`, `cardSeconds`).
Output: H.264 at 30 fps and 11 Mbps, stereo AAC (silence when the recording has no audio), 15–30 s, checked with ffprobe.
App Store Connect sets the poster frame per preview (default: the frame at 5 s); `GET /api/video/frame` shows a frame
of a generated preview to choose it. Only real app footage belongs in a preview.

### Device videos and looping header / search videos

`POST /api/generate/embed-videos` puts each recording in a device frame on a background for websites and social
posts: 9:16 (1080×1920), 16:9 (1920×1080) and 1:1 (1080×1080), with an optional line of text per language (`texts`),
`frame`, `background` (default: the header image background) and `trim`. The recording's audio is kept.

`POST /api/generate/loop-videos` makes the App Store's looping product page header (3840×1646) and search results
(1920×1280) videos: the layout of the header and search images with the language's phrase, and the recording playing
in the key-art device. The end crossfades into the start, so the loop has no jump; 30 fps, 5–30 s, no audio (the App
Store plays them muted).

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
| `npm test` | Unit tests (Vitest); see [docs/testing.md](docs/testing.md) for a faster local run |
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
