# Design

## Decisions

1. **Abort instead of ignoring.** The page keeps the `AbortController` of the running download in a ref. The cleanup
   of the effect that reloads the checklist aborts it on a selection or project change and when the page unmounts, so
   the old result can never reach the state or `saveBlob`. The selection is compared by content (`localeKey`), so a
   click that leaves the languages unchanged aborts nothing.
   - *Limit:* the server builds the ZIP to disk before it answers and does not stop that build when the client
     aborts; the finished file stays in `exports/` like every export. Cancelling the build belongs to the streaming
     work in #47.
   - *Alternative:* lock the language bar while a download runs. Rejected: it blocks the user for the length of a
     large export and needs a disabled state in the shared locale bar for one page.
   - *Alternative:* only ignore the late result (request id). Rejected: the browser would keep receiving the old ZIP
     next to a new one.
2. **One download at a time** through the same ref: `runDownload` returns while a controller is active. The ref is
   cleared only by the run that set it, so an aborted run never clears a newer one.
3. No new component; the change is page logic plus an optional `signal` on `downloadExport`.

## Review log

- **/code-review:** 7 findings.
  - Fixed: the abort depended on the array identity of the selection (a no-op click aborted the download) → content
    key; no abort on unmount → abort in the effect cleanup, which also replaced the reset in the effect body; the e2e
    test waited a fixed 500 ms → it waits for the aborted request (`requestfailed`); CHANGELOG line added.
  - Corrected in this design: the server does not stop building an aborted ZIP (limit noted, follow-up in #47).
  - Accepted: the busy-button click in the e2e test is stopped by `BusyButton` before the new ref guard; the guard
    is defence in depth for a start that bypasses the button state (e.g. confirm before re-render).
