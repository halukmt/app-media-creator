Issue: #92

# Proposal

## Why

Codex findings on PR #91:
1. **P1:** with slow saves, flushes already queued behind a refused save still ran after `discard()`, stamped with the
   newly loaded revision, and could overwrite the other tab's changes.
2. **P2:** after a conflict reload, the card previews kept showing the earlier version.

## What Changes

- The save queue counts discard generations; a queued run of an earlier generation is skipped.
- New option `discardOn(error)`: the queue drops everything not yet sent in the same step as the refused save, before
  the next queued run can start. The Screenshots page sets it for 409.
- A reload that brings a newer revision bumps the preview version.

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `screenshot-sets`: conflicts drop queued edits; previews follow the loaded version.

## Impact

- `src/web/lib/save-queue.ts`, `src/web/pages/ScreenshotsPage.tsx`; `tests/unit/save-queue.test.ts`.
