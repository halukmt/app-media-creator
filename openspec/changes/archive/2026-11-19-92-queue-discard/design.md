# Design

## Decisions

1. **Drop inside the queue, not in the caller:** the next queued run starts in the microtask after the refused save,
   before the caller's `catch` can call `discard()` (the first version of the test showed exactly that). So the queue
   itself decides with `discardOn(error)` and raises the generation in the same step.
2. **Generations:** each flush remembers the generation it was queued in; a run of an older generation rejects with
   `SaveDiscardedError` without calling `save`, so a caller of that flush never mistakes "dropped" for "stored".
   `discard()` raises the generation too (manual drops cover queued runs) and reports whether anything was dropped; a
   reload with a newer revision uses it to show the conflict note only when edits were really lost.
4. **Known revision never goes back:** a save answer that arrives after a reload of a newer revision keeps the newer one.
5. **One conflict rule** (`isConflict`) for `discardOn` and `flushSave`; `flushSave` treats a dropped flush like a
   conflict: it shows the note, waits for the reload and lets the caller go on.
3. **Previews:** a reload with a higher revision than the page knew means texts or styles changed elsewhere; it bumps
   the preview version, so the card previews are rendered from the loaded sets.

## Review log

- **/code-review:** 8 findings. Fixed: the reload path still only discarded when a version was pending, not when one
  was queued → `discard()` covers queued runs and reports drops; a dropped flush resolved like a save, so Generate or
  Prepare could start without the warning → `SaveDiscardedError`, handled like a conflict; the known revision could go
  backwards → `Math.max`; `last` kept the rejection on the `discardOn` path → reset in the shared drop; two copies of the
  conflict rule → `isConflict`; a double preview refresh after an apply → the release no longer bumps; tests for manual
  discard of queued runs and for a later empty flush; the queue contract now names the exception. Accepted: a
  first-load preview bump (0 → n).
