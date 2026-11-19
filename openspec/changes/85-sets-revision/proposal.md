Issue: #85

# Proposal

## Why

`PUT /api/screenshots` overwrote the whole stored document. A second tab, or any writer that loaded the sets earlier,
could save an older version over newer changes, such as AI headlines applied in another tab. The reviews of #84, #87
and #89 traced three client-side lock fixes back to this missing check.

## What Changes

- `screenshots.json` gets a `revision`; each save stores the next one.
- `saveScreenshotSets` rejects an input whose `revision` is not the stored one (`conflict`). Saves are serialized.
  Internal callers that read and save in one step (e.g. `applyHeadlines`) pass their revision along.
- `PUT /api/screenshots` requires a revision (400 without one) and answers 409 with the current sets on a conflict.
- The Screenshots page stamps each save with the revision of its last save or load. On 409 it drops the refused edit
  (new `discard()` on the save queue), reloads and shows "changed elsewhere".

Acceptance criteria from the issue:
- Stored settings documents carry a revision; a save names the revision it is based on.
- A save based on an older revision is rejected with 409, and the UI reloads and says that the data changed elsewhere.
- Applying AI headlines bumps the revision.
- Unit and e2e tests (two pages editing the same set).

Scope: the screenshot sets, where the AI apply writes. Logo and creative settings have one writer per page and keep
their current behaviour.

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `screenshot-sets`: revision-checked saves.

## Impact

- `src/core/workspace/screenshot-sets.ts`, `src/server/workspace-routes.ts`, `src/web/api.ts`,
  `src/web/lib/save-queue.ts`, `src/web/pages/ScreenshotsPage.tsx`, `src/web/i18n/en.ts`; tests.
