# Video tools, text humanizer and AI access (research 2026-11-18)

Facts were checked on 2026-11-18 via `gh api` and web fetches. Guesses are marked.

## 1. Video tools

| Repo | How it works | Inputs | Output | Dependencies | Install | License | Activity |
|---|---|---|---|---|---|---|---|
| [latent-spaces/brag](https://github.com/latent-spaces/brag) | `/brag` writes story + brief, [HyperFrames](https://github.com/heygen-com/hyperframes) renders HTML + GSAP to MP4. `/brag-slim` uses ffmpeg + headless browser and reuses the project's real CSS | Current repo, site URL | MP4 + poster + share copy; 1920×1080 default, 1080×1920, 1080×1080; 30 fps; 15–25 s | Node 22+, FFmpeg, `npx hyperframes`; optional Kokoro voice; no API key | `/plugin marketplace add latent-spaces/brag` or `npx skills add https://github.com/latent-spaces/brag --skill brag` | **MIT**; bundled music CC BY 4.0 (attribution), SFX Kenney | 21.9k★, last commit 2026-11-15 |
| [OutOfAmine/hype-reel](https://github.com/OutOfAmine/hype-reel) (installed in `~/.claude/skills/hype-reel`) | puppeteer-core captures real screens; `reel.json` storyboard → React 18 + Framer Motion player (CDN) → frame-exact seek → ffmpeg-static H.264. Scenes: device fly-in, exploded layers, tunnel, mask, orbit, counter, wipe | URL, local app, repo with dev server, product photo, voice WAV | MP4 30 fps; 9:16 1080×1920, 16:9, 1:1, 4:5; share page | Node 18+, Python 3, Chrome/Edge; optional node-pty, kokoro, torch; no API key | `git clone` into `~/.claude/skills/hype-reel` + `npm install` | **MIT** | 19★, last commit 2026-10-30 |
| [owlinthebarnai/video-studio-kit](https://github.com/owlinthebarnai/video-studio-kit) | Local web app spawning `claude -p` with the user's subscription, 50+ bundled skills | Text prompt + style | 9:16 / 16:9 / 1:1 MP4, 20–45 s | Claude Code login, Node 20+, Python 3.10+, ffmpeg, ~3 GB | `node setup.mjs` | **No license** → do not copy, link only | 88★ |
| [haiderfarooq3/paper-reel](https://github.com/haiderfarooq3/paper-reel) | Cut-paper explainer reels, HTML canvas, Kokoro voice, whisper.cpp, Playwright | Topic / script | 1080×1920 30 fps | macOS, Node 18+, ffmpeg, whisper.cpp, Python | `git clone` into skills | **MIT** | 145★ |
| [0xS4N4TG/kinetograph](https://github.com/0xS4N4TG/kinetograph) | Browser-free engine: Remotion-API TSX or HTML/HyperFrames, Rust/Skia compositor | Code, images, video | MP4 any size | Node 22+, prebuilt binaries | `npx kinetograph skills update`, MCP | **Apache-2.0**; importing `remotion` brings the Remotion License (inference) | 535★, beta |

### Fit

- **App Store preview** (886×1920, 15–30 s, ≤30 fps, stereo AAC, only real in-app footage): none of the reel tools.
  3D fly-ins, tunnels and glitch wipes risk App Review. → **own ffmpeg pipeline**: scale/pad, text cards, fades,
  silent stereo track if no audio, H.264 ≤30 fps.
- **Play promo video:** YouTube URL, landscape or portrait, first 30 s autoplay muted. → brag/HyperFrames 16:9 or hype-reel.
- **Web/social reels:** hype-reel and brag/HyperFrames.

### Alternatives

- **HyperFrames** (heygen-com/hyperframes): Apache-2.0, 86k★, HTML + GSAP → deterministic MP4, top skills on skills.sh.
- **Remotion**: custom "Remotion License", not OSI; free only for individuals, ≤3-employee companies, non-profits.
  "Remotion for Automators" covers prompt-to-video tools. remotion-dev/skills has no license. → **do not bundle**.
- Revideo (MIT), Motion Canvas (MIT), echris6/motion-video-kit (MIT), charlie947/motion-graphics-skills (MIT),
  AbubakrChan/product-launch-motion (MIT), aaitor/skill-video-studio (MIT), Avijit07x/cursorcam (Apache-2.0).
- OpenMontage: **AGPL-3.0** → avoid.
- Screenshot framing: fastlane `frameit` (MIT), andresdefi/appframe (MIT), alyssaxuu/animockup (MIT, inactive).
- Skill registries: [lazyskills](https://github.com/alvinunreal/lazyskills) (MIT, Go TUI, `lazyskills.sh` installer)
  searches **skills.sh** (Vercel, `npx skills add owner/repo`). Assumed to be what "lazyskills / .sh" meant.

### Decision (2026-11-18)

- Store previews: own ffmpeg pipeline.
- Promo videos: both engines selectable — HyperFrames/brag and hype-reel.
- ffmpeg: system binary preferred, `ffmpeg-static` optional (GPL/LGPL build → do not vendor).

## 2. Text humanizer

[Dodaios/ste80-humanizer](https://github.com/Dodaios/ste80-humanizer): Agent Skill. Pass 1 removes 26 "AI tells"
(adapted from blader/humanizer, MIT); pass 2 rewrites 80 % toward ASD-STE100 (one idea per sentence, active voice).
Modes Humanize / Light / Strict. Optional linter `python scripts/ste_check.py`. Works for other languages via pass 1 +
pass 2 structure rules. Install: `npx skills add Dodaios/ste80-humanizer`.
**License MIT** (© 2026 Dodaios; includes MIT code © 2025 Siqi Chen) → may be bundled with both notices, or referenced as install step.
Not designed for short ad headlines → use Light mode on longer texts only.

## 3. AI access without an API key

Official statements:
- https://code.claude.com/docs/en/legal-and-compliance — OAuth subscription login "is intended exclusively for
  purchasers of Claude … subscription plans and is designed to support ordinary use of Claude Code". Third-party
  developers may not "route requests through Free, Pro, Max, or Ultra plan credentials on behalf of their users".
  An end user signing in to the unmodified Claude Code binary with their own subscription is allowed.
- https://code.claude.com/docs/en/agent-sdk/overview — third-party developers may not offer claude.ai login or rate
  limits for their products; use API key authentication.
- https://support.claude.com/en/articles/15036540 — Agent SDK / `claude -p` usage with a plan counts against plan limits.

Options:
1. Local server spawns the user's `claude -p` → gray area for a distributed tool. **Not used.**
2. `ANTHROPIC_API_KEY` in `.env` → clearly permitted, billed to the key owner. **Optional in-UI "Generate" button.**
3. Job folder + Claude Code skill run by the user in their editor → plain interactive use. **Default.**
