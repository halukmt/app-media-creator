Issue: #116

# Proposal

## Why

Codex finding on PR #114. A prepared Export ZIP that is never fetched was only removed by the next export request
(the sweep ran inside `issue()` / `take()`), and a restart lost the in-memory tokens, so such ZIPs stayed in `exports/`
for good. With videos they can be hundreds of megabytes.

## What Changes

- `src/server/prepared-downloads.ts` (moved out of the routes): each token gets its own expiry timer (`unref`, so it
  does not keep the process alive, and a clock change cannot keep it alive); prepared ZIPs are built in a folder of
  the current run below `exports/prepared/`; the first fetch moves a ZIP to `exports/` like every other export
  (parallel fetches share the move); an expired ZIP never fetched is removed; `cleanUp()` removes waiting folders of
  earlier runs older than the token lifetime at start (fresh folders of other live instances stay).
- Only a vanished file answers "expired" (404); other file errors reach the error handler and the log.
- `createExport` takes a `folder` option (an existing folder).
- Code review: 10 findings, all applied (parallel fetches, per-run folders against other instances and the startup
  race, real errors logged, timer independent of the clock, docs, folder creation in the downloads module, tests with
  a factory, no sleeps, a route-level test).

Acceptance criteria from the issue:
- Expiry runs on its own timer, not only on the next request.
- Prepared ZIPs wait in their own folder; a fetched one moves to `exports/`; leftovers of an earlier run are removed at
  start.
- Unit tests for the timer, the move on fetch and the startup cleanup.

Targets: all. Locales: not applicable.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `export`: prepared ZIPs are removed on their own timer and after a restart.

## Impact

- New: `src/server/prepared-downloads.ts`. Changed: `src/server/export-routes.ts`, `src/core/export/zip.ts`,
  `tests/unit/server-export.test.ts`.
