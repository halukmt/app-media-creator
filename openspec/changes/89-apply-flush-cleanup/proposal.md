Issue: #89

# Proposal

## Why

Codex finding on PR #88: when saving pending edits failed before an AI apply, `applyAiJob` returned early and skipped
its cleanup. The apply button stayed busy, both apply buttons stayed disabled and the "Changes are paused" note stayed,
although nothing was applied.

## What Changes

- When saving fails, `applyAiJob` cleans up in that branch: busy state cleared, the paused note shown only while an
  earlier apply still waits for its reload, and that reload tried now. Once the request was sent, a reload always
  follows.
- E2E test for the failing save before an apply (fails on the previous code).

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `ai-jobs`: cleanup after a failed save before applying.

## Impact

- `src/web/pages/ScreenshotsPage.tsx`, `tests/e2e/screenshots.spec.ts`.
