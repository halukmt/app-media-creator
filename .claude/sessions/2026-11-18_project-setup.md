# 2026-11-18 Project setup (M0, issue #1)

## Result

- Repo `halukmt/app-media-creator` (private), branches `main` and `dev` (default `dev`), CI green on `dev`.
- Project 10 "app-media-creator" with Status (Backlog, Ready, In progress, In review, Done, Released), Priority, Size.
- Milestones M1–M7, issues #1–#28:
  - #1 setup: Done (closed)
  - #2–#14 (M1 core, shell, logo pack, export; M2 screenshots): Ready
  - #15–#26 (M3 AI copy, M4 creative assets, M5 video, M6 store texts, M7 release): Backlog
  - #27, #28: `task-haluk` sub-issues of #25 (go public) and #26 (npm token)
- Plan: `.claude/plans/2026-11-18_app-media-creator-setup.md` (includes the localization section for the 6 locales).
- Research: `.claude/research/` (store specs, video tools and AI access, strategy and copy rules).

## Decisions

- Everything in English; chat with Haluk in German.
- Distribution: npm CLI + Claude Code skills. Prototype moved to `legacy/` (reference only), then gitignored
  and removed from the git history (local only on Haluk's machine).
- AI: job folder + skill by default, optional `ANTHROPIC_API_KEY`; no `claude -p` from the server.
- Video: own ffmpeg pipeline for App Store previews; HyperFrames/brag and hype-reel selectable for promo reels.
- Media in 6 locales (`de-DE`, `en-US`, `es-ES`, `it-IT`, `fr-FR`, `tr-TR`), one / several / all; App Store Connect codes `it`, `tr`.
- Security: gitleaks in CI (as in ki-mal-mit). GitHub secret scanning, push protection and CodeQL after going public (#25).

## Notes for /next-issue

- Start with #2 (spec and locale catalogue); most M1 issues depend on it and on #3.
- First UI issue (#4) must run `component-architect` and load `daisyui` (hook enforces it).
- Stack versions: Vite 8, TypeScript 7 (native `tsc`), React 19, Tailwind 4.3, DaisyUI 5.8, Hono 4, Vitest 5, Playwright 1.65.
- `legacy/` is local only (gitignored): issues #11 and #14 reference it, so they need Haluk's machine or a
  description of the layouts. App-specific strategy notes live outside the repo (Obsidian).
- `release.yml` skips when the CHANGELOG has no dated version yet (the first push to `main` had failed).
