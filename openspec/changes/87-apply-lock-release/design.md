# Design

## Decisions

1. **One lock state instead of patches.** The first fix (release in `reload()`) raised new races in review, so the edit
   lock around applying AI headlines is now two values in one place:
   - `applyRunning`: an apply request runs; edits are refused and no reload may release anything;
   - `lockedAfter`: set when the server holds applied texts, to the number of the last reload started before that.
     Only a successful reload with a higher number (started afterwards, so it fetched the applied texts) releases it.
2. **Numbered reloads:** each `reload()` gets a number; an older reload that answers after a newer one started is
   dropped, so out-of-order responses can never put stale sets on the page.
3. **Release after render** stays: a reload only asks for the release (`releaseLock`); the effect clears the lock after
   the reloaded sets are rendered and bumps the preview version, so the previews show the applied texts.
4. **Every apply attempt ends with a reload** before edits are taken again, also after an error: the server may have
   saved the headlines before the answer was lost. The button stays busy until that reload is done, and an info line
   ("Changes are paused …") explains refused edits while the lock lasts.
5. **E2E test:** apply variant A while the following GET of the sets fails once; edits are refused; an upload (another
   reload path) brings the applied text and edits work again. The test fails on the previous code.
6. The root cause is that saving the sets has no revision check; #85 adds one and would make most of this client lock
   unnecessary. This fix keeps the page safe until then.

## Review log

- **/code-review (first version, release in `reload()`):** 7 findings: a reload started before the apply could
  release the lock; a reload during a second apply could release it; a failed second apply unlocked although an
  earlier lock waited; out-of-order reloads could overwrite sets; no preview refresh on release; no test; a double
  blank line. All addressed by the redesign above and the e2e test.
- **/code-review (redesign):** 10 findings. Fixed: busy state ended before the post-apply reload → stays until it is
  done; refused edits were silent → info line while locked; an apply error with an unknown outcome unlocked at once →
  every attempt reloads before edits; the test did not check the server → it reads the stored headline; effect
  dependencies and the task text. Accepted: a successful reload superseded by a newer failing one is dropped (the
  error and "Try again" stay); the test depends on the earlier serial tests like the rest of this file; a second preview
  refresh after an upload that releases the lock. Root cause → #85 (revision check), suggested for P1.
