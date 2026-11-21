Issue: #118

# Proposal

## Why

Two Codex findings on PR #117. After a quick restart, the previous run's waiting folder was still younger than the
token lifetime, was skipped by the one cleanup at start, and stayed on disk. And when the first move of a fetched ZIP
failed (for example a file locked by antivirus), the rejected move was cached: every retry failed, and expiry treated
the ZIP as fetched and left it.

## What Changes

- `cleanUp()` schedules a later check for a waiting folder it skipped, at the moment it becomes older than the
  lifetime; then the folder is removed (a live instance keeps its folder fresh by writing to it).
- The shared move is cleared when it fails, so the next fetch retries; only a successful move marks the ZIP as
  fetched, so expiry still removes an unclaimed one.

Acceptance criteria from the issue:
- A waiting folder skipped at start is checked again once it is older than the lifetime, and removed then.
- A failed move can be retried; only a successful move counts as fetched.
- Unit tests for both (they fail on the old code).

Targets: all. Locales: not applicable.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; the export requirement of #116 already describes this behaviour, so no delta spec: `skip_specs`)

## Impact

- `src/server/prepared-downloads.ts`, `tests/unit/server-export.test.ts`.
