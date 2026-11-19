Issue: #48

# Proposal

## Why

Codex found this on #46: when the user changes the languages while a ZIP request is still running, the reload resets
the download state, but the running request writes its result afterwards. A success message (and a saved ZIP) for the
old selection then appears next to the new checklist. Because the reset also makes the Download button active again,
a second download can start, and the older request can overwrite its status.

## What Changes

- A running download is aborted when the selected languages or the saved project change. Its result is never shown
  and its ZIP is never saved.
- Only one download runs at a time: a second start while one is running is ignored.
- `downloadExport` accepts an `AbortSignal`.

Acceptance criteria from the issue:
- A download result is only shown for the selection it was started with.
- Only one download runs at a time.
- E2E or unit test for the guard.

Targets: App Store, Google Play, Web. Locales: all 6 (no change to locale handling).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: the ZIP download belongs to the selection it was started with.

## Impact

- `src/web/pages/ExportPage.tsx`, `src/web/api.ts`; e2e test in `tests/e2e/export.spec.ts`.
