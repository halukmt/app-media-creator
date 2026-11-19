Issue: #15

# Proposal

## Why

AI copy (M3) runs by default through a job folder and a Claude Code skill the user starts in their editor. The server
never spawns `claude -p` (see `.claude/research/2026-11-18_video-tools-and-ai-access.md`). Before the `amc-copy`
skill (#16) and store texts (#24) can work, the contract between the tool and the AI is needed: what the tool writes,
what the AI writes back, how results are checked, and how the UI learns about them.

## What Changes

- **Job folder** `<workspace>/jobs/<id>/` (`createJob`):
  - `brief.json`: project, languages, the screenshots of each language (its own set or the source language's, flagged
    as fallback) with current headlines, video frames, notes, result paths and store text fields;
  - `claims.json` from the project;
  - `images/` with each screenshot copied once;
  - `frames/<video>/frame-NN.jpg`: one frame every 2 s, at most 12, via ffmpeg (`FFMPEG_PATH` or the PATH, run without
    a shell). Without ffmpeg the job is still created and the brief notes it;
  - `schemas/headlines.schema.json` and `schemas/storyboard.schema.json`, generated from the zod schemas.
- **Results the AI writes**, validated by `readJob`:
  - `headlines.json`: per locale and slot, variants A (outcome first) and B (mechanism first);
  - `store-texts/<locale>/<field>.md`: fixed field list;
  - `storyboard.json`: scenes from job images with captions per locale.

  Invalid results (bad JSON or schema, unknown screenshots, images or locales, forbidden claims, wrong file names)
  make the job `invalid`, and nothing of it is exposed or applied. Long headlines are warnings.
- **Apply** (`applyHeadlines`): writes one variant into the screenshot sets, keeps style overrides, and gives fallback
  languages their own set; marks the job `applied`.
- **Server:** `GET/POST /api/jobs`, `GET /api/jobs/:id`, `POST /api/jobs/:id/apply`, and `GET /api/jobs/events`
  (server-sent events from a folder watcher, debounced per job, running only while someone listens).
- **UI:** Screenshots preview step gets "Write headlines with AI" (`AiJobPanel`): prepare a job for the selected
  languages, show the command to run (`CommandBox`, copyable), wait live, compare A and B per language
  (`HeadlineVariantsCard`), and apply after a confirmation.

Acceptance criteria from the issue:
- `jobs/<id>/brief.json`, `claims.json`, images and video frames (ffmpeg) written by the server.
- Result files `headlines.json` (per locale, per slot, variants A / B), `store-texts/<locale>/*.md`,
  `storyboard.json` with JSON schemas.
- The server watches the folder and pushes updates to the UI; invalid results are reported, never applied.
- The UI shows the command to run in the editor.

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- `ai-jobs`: job folder contract, result validation, apply, live updates.

### Modified Capabilities
- (none)

## Impact

- New: `src/core/jobs/` (schemas, frames, jobs), `src/server/jobs-routes.ts`, `src/web/components/AiJobPanel.tsx`,
  `CommandBox.tsx`, `HeadlineVariantsCard.tsx`, `src/web/lib/ai-jobs.ts`, tests.
- Changed: `src/server/app.ts`, `src/web/api.ts`, `src/web/pages/ScreenshotsPage.tsx`, `src/web/i18n/en.ts`,
  `src/web/components/INVENTORY.md`.
- The `amc-copy` skill itself is #16; exact store text limits come with #24.
