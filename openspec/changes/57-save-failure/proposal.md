Issue: #57

# Proposal

## Why

Codex found on #56 that a failed save of screenshot edits is swallowed: the pending edits are dropped and the flush
resolves, so "Generate" renders from older saved data and "Upload" reloads over the unsaved edits.

## What Changes

- A small save queue (`src/web/lib/save-queue.ts`): one save at a time, the newest version wins, a failed save keeps
  the version pending (unless a newer one was scheduled) and rejects the flush.
- The Screenshots page uses it; upload and generate stop with "Your latest changes could not be saved, so nothing was
  started" when the flush fails, and the edits stay on screen.

Acceptance criteria from the issue:
- A failed save keeps the pending edits and rejects the flush.
- Upload and generate stop with an error message when the flush fails.
- Test for the failure path.

Targets: App Store, Google Play, web. Locales: all 6 (no change).

## Not in this change

- Automatic retries of a failed save (the next edit or action retries it).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell`: unsaved screenshot edits are never lost or bypassed.

## Impact

- `src/web/lib/save-queue.ts`, `src/web/pages/ScreenshotsPage.tsx`, `src/web/i18n/en.ts`; `tests/unit/save-queue.test.ts`.
