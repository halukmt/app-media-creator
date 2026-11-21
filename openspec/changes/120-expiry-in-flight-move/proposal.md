Issue: #120

## Why

Codex on #119: when a fetch of a prepared ZIP starts just before its token expires, the move out of the waiting
folder may still be running when the expiry timer fires. `fetched` is still false, so expiry deletes the ZIP under
the valid fetch, which then fails with ENOENT and answers "expired".

## What Changes

- Expiry waits for a move that is in flight. It removes the ZIP only when no move succeeded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None (bug fix inside the existing prepared-download behaviour; no requirement changes).

## Impact

- `src/server/prepared-downloads.ts`, `tests/unit/server-export.test.ts`, CHANGELOG.
