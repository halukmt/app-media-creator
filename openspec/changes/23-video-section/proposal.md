Issue: #23

# Proposal

## Why

The video pipelines (#20 App Store previews, #21 device videos and header / search loops) exist only as API routes.
Users need the Video section to upload a recording, choose what the videos are for, set the options and make them.

## What Changes

- `src/web/pages/VideoPage.tsx` (replaces the generic placeholder page, which is removed because every section now has
  its own page): the L2 steps Upload → Purpose → Options → Export.
  - Upload: a recording per language (LocaleSelector single), the recordings that matter for the selected languages,
    a note when a language falls back to the source language's recording.
  - Purpose: App Store preview, device video, header and search loop (hints built from catalogue sizes and lengths);
    promo reel shown as "Comes later" (#22); purposes whose store is off are disabled with the reason.
  - Options: trim start / end (decimal input, field errors), per purpose the text cards per language and their length,
    or formats, frame and text per language, or a note that the loop uses the header image settings.
  - Export: one generate request for the selected languages (the generators encode shared recordings once), progress
    in a live region, the reasons why the button is off next to it, a grid of the purpose's videos with `<video>`
    players, catalogue size and the validation badge from the export checklist; the poster frame note.
- Settings persist in `<workspace>/video.json` (`GET` / `PUT /api/video/settings`, zod) through `useAutosave` and
  `useLoadAfterSaves`.
- `GET /api/output/file` also serves `.mp4` manifest entries, streamed with HTTP byte ranges (206 / 416).
- `GET /api/catalogue` lists the videos the tool writes (size, allowed length).
- Reuse: `useOutputStatuses` (from LogoPage), `lib/frames.ts` (`FRAME_KINDS` from ScreenshotsPage), `TextField`
  gets `inputMode`. CI installs ffmpeg in the e2e job.

Acceptance criteria from the issue:
- Purpose step with the options and their store rules explained (four options; the promo reel comes with #22).
- Progress with `aria-live` for long renders; result previews with validation badges.
- E2E test with a short sample video.

Targets: App Store, web / social. Locales: all 6 (texts per locale, generate for the selected languages).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: the Video section.

## Impact

- New: `src/web/pages/VideoPage.tsx`, `src/web/lib/{video,frames}.ts`, `src/web/hooks/useOutputStatuses.ts`,
  `src/core/workspace/video-settings.ts`, tests `tests/unit/{web-video,video-settings}.test.ts`,
  `tests/e2e/video.spec.ts`.
- Changed: `src/web/{App.tsx,api.ts,i18n/en.ts}`, `src/web/pages/{LogoPage,ScreenshotsPage}.tsx`,
  `src/web/components/{TextField.tsx,INVENTORY.md}`, `src/server/{export-routes,video-routes,catalogue-routes}.ts`,
  `playwright.config.ts`, CI.
- Removed: `src/web/pages/SectionPage.tsx`.
