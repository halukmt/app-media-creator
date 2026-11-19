Issue: #84

# Proposal

## Why

Codex review comments on PR #83 (AI job folders) found four problems:
1. **Data loss:** an edit made while "Apply variant" and the reload run queues a save of the older document, which can
   overwrite the applied headlines.
2. `applied.json` hashed `headlines.json` after the sets were saved, so a rewrite in between recorded the wrong result.
3. A pending job refresh could arrive after "Prepare AI job" and switch the panel back to the old job.
4. `store-texts` as a file (or an unreadable folder) made the job endpoint answer 500 and broke the job list.

## What Changes

- `ScreenshotsPage`: `updateSets` ignores edits while an apply runs (flush, apply, reload).
- `readJob` fingerprints the `headlines.json` text it validates; `applyHeadlines` records that fingerprint.
- Job refreshes (event stream and after apply) update the panel only for the job it shows.
- The `store-texts` check is guarded: a file or a read error becomes a job error.

Acceptance criteria from the issue: all four fixed; tests for 2 and 4; 1 where practical.

Targets: not target-specific. Locales: all 6.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `ai-jobs`: safe apply and broken result folders.

## Impact

- `src/core/jobs/jobs.ts`, `src/web/pages/ScreenshotsPage.tsx`; tests in `tests/unit/ai-jobs.test.ts`.
