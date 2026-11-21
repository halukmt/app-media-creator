Issue: #22

## Why

Google Play, websites and social posts need short promo reels in 16:9, 9:16 and 1:1 with text per language. Haluk
decided (2026-11-20) that the engine is brag (HyperFrames, Apache-2.0, via the MIT-licensed brag skill); hype-reel is
not built.

## What Changes

- New specs `web.promo.landscape|vertical|square` and `google.promo-video` (the YouTube file for the Play listing),
  all `verified: false` with their source.
- New AI job task `promo-video`: the brief carries engine, formats with exact sizes, length, sources (website,
  repository) and the output path `videos/<locale>/<format>.mp4`. Material: screenshots, recording frames or a URL.
- The tool checks each rendered video with ffprobe against its spec; wrong sizes, other names or languages make the job
  invalid. Applying copies the videos into the outputs (web promo per format, 16:9 also as the Play YouTube file).
- New skill `skills/amc-video` (SKILL.md, promo rules, check script) that plans one story, localizes the captions and
  batch-renders every language and format with brag, without music by default.
- Video section: "Promo reel" becomes a real purpose, also without a recording; formats and website / repository are
  saved; Export shows the AI job panel and a YouTube note.
- THIRD_PARTY_NOTICES lists brag (MIT) and HyperFrames (Apache-2.0) as tools the skill calls (not bundled).
- README: promo reel docs; the store texts install step had terminal output instead of the command (fixed).

## Capabilities

### New Capabilities

- `promo-videos`: promo reel specs, the promo-video job, its checks and outputs, and the Video section purpose.

### Modified Capabilities

None.

## Impact

- Core: `src/core/specs/{types,web,google}.ts`, `src/core/jobs/{promo,jobs,index}.ts`, `src/core/workspace/video-settings.ts`.
- Server: `src/server/jobs-routes.ts`.
- UI: `VideoPage.tsx`, `hooks/usePromoJob.ts`, `lib/video.ts`, `api.ts`, `i18n/en.ts`, `TextField.tsx` (inputMode url).
- Skill: `skills/amc-video/`. Docs: README, THIRD_PARTY_NOTICES, CHANGELOG.
