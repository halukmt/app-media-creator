Issue: #87

# Proposal

## Why

Codex finding on PR #86: after a successful apply with a failed reload, only the "Try again" button released the edit
lock. Another successful reload (e.g. after an upload) cleared the error and removed the button while the lock stayed,
so every screenshot edit was refused until the page was reopened.

## What Changes

- The edit lock is redesigned: `applyRunning` plus `lockedAfter` (a reload number); only a successful reload started
  after the apply releases it, rendered first; reloads are numbered so late answers are dropped.
- The "Try again" button only calls `reload()`; any later successful reload (e.g. after an upload) recovers the page.
- E2E test for an apply whose reload fails.

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `ai-jobs`: the edit lock recovers with any successful reload.

## Impact

- `src/web/pages/ScreenshotsPage.tsx`, `tests/e2e/screenshots.spec.ts`.
