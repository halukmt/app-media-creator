## Context

The tool never spawns Claude; AI work runs through job folders and skills (#15). Promo reels follow the same contract:
the tool writes the brief, the user runs `/amc-video "<job>"`, the skill renders with brag and saves MP4s, the tool
checks and applies them.

## Decisions

- **Engine brag only** (Haluk, 2026-11-20). The skill calls brag; neither brag nor HyperFrames is bundled.
- **Separate module** `src/core/jobs/promo.ts` for brief, checks and apply; `jobs.ts` only routes the task.
- **Checks with ffprobe** on every read of the job: exact size per format, MP4, length (web 5–60 s, Play 10–120 s),
  at most 60 fps and 500 MB, regular files only. Missing languages or formats are warnings, so a partial result
  applies.
- **Applied fingerprint**: path, size and change time of every checked video; a re-render is a new result.
- **Outputs**: `web/<locale>/promo-<format>/01-promo.mp4` with the web target on, and the 16:9 one also as
  `google/<locale>/promo-video/01-promo.mp4` with Google Play on; earlier promos of these languages are replaced.
- **Music**: `--no-music` by default; bundled CC BY tracks only on request, with `videos/CREDITS.txt`.
- **UI reuse map (component-architect)**: purpose `OptionGroup` card; formats reuse the device video multi-select
  (`toggleFormat` in `lib/video.ts`); `TextField` with `inputMode="url"`; `AiJobPanel` composed directly in the page
  with `AiResultCard` rows per format; state in a new hook `usePromoJob` (no markup). No new component. Rejected: a
  `PromoJobPanel` wrapper (only fixed props on `AiJobPanel`).
- **No recording needed**: the Purpose step opens without one; the other purposes stay disabled with a note.

## Risks

- ffprobe runs per video on each job read (job watcher events). A handful of files per job; acceptable.
- brag's options may change; the skill describes the intent (format, duration, no music) rather than flags only.
