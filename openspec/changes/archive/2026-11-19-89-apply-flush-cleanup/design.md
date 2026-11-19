# Design

## Decisions

1. **Cleanup where the early return happens:** the only early return is the failed save before the request; that branch
   resets `applyRunning`, the busy state and the paused note itself (no flag across nested `finally` blocks). If an
   earlier apply still waits for its reload, the branch starts that reload, so a release skipped while this apply ran
   is not lost.
2. **Paused note follows the lock:** `setEditsLocked(lockedAfter.current !== null)` keeps the note for an earlier apply
   whose reload failed and clears it otherwise.
3. The e2e test waits for the confirmation dialog to close before checking the buttons (the native dialog closes one
   frame later, and its own "Apply" button matches the same name until then).

## Review log

- **/code-review:** 6 findings. Fixed: an earlier lock kept on the not-sent path without a reload (a release skipped
  during the apply could be lost) → reload started; the `sent` flag across nested `finally` blocks → cleanup in the
  failing branch; the test did not prove that no apply request was sent or that edits work again → request counter and
  a second edit; `unroute` not in `finally`; a double blank line. Accepted: a single acquire/release helper for the
  lock (the remaining state is two refs and one flag; #85 is the real fix); the serial dependency of the e2e tests.
