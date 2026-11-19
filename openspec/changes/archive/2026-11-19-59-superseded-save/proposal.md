Issue: #59

# Proposal

## Why

Codex found on #58 that the save queue restores a failed version whenever the pending slot is empty. If a newer
version was already flushed (queued or saved) while the older save was running, the older one comes back and the next
flush writes it over the newer edits.

## What Changes

- Every scheduled version gets a number. A failed save restores its version only when no newer version was scheduled
  after it.

Acceptance criteria from the issue:
- A failed save restores its version only if no newer version was scheduled after it.
- Test for the sequence old (fails), new (succeeds), next flush (must not write old).

Targets: App Store, Google Play, web. Locales: all 6 (no change).

## Not in this change

- Nothing else in the queue's behaviour.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell`: a failed older save never overwrites newer edits.

## Impact

- `src/web/lib/save-queue.ts`; `tests/unit/save-queue.test.ts`.
