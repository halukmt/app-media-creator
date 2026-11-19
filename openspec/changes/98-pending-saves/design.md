# Design

## Reuse map (component-architect)

- `StatusAlert` as is (tone error, title, an `a.link` to `sectionHref(section)` as child). Rejected: an `UnsavedAlert`
  wrapper (only wraps StatusAlert with one link, merge rule) and `SaveStatus` (save state of the open page, not of a
  section already left). No INVENTORY change.
- Placement in `App.tsx` before the pages: App owns section and load state; `AppShell` stays unaware of sections' data.
- One `<div role="alert">` stays mounted and holds the alerts with `announce={false}`, so a failure that arrives after
  a navigation is announced once. Focus never moves to it; the page heading keeps focus.

## Decisions

1. **A tracker module, not keeping pages mounted.** Keeping Logo/Screenshots/Store texts mounted like Project would
   keep drafts, but Export would still race with the debounced save, and hidden pages would keep event streams and
   preview renders running. The tracker is small, pure and unit-tested.
2. **Who waits.** Export's checklist and the first load of each autosaved document. Later reloads inside a page need
   no wait: that page's own saves run through its queue.
3. **Conflict counts as lost.** After leaving, an edit dropped by a 409 is gone just like a failed one; the hook's
   unmount flush turns "dropped" into a rejection (`DroppedSaveError`) for the tracker. One message covers both; the
   section opened again shows the stored version.
4. **The message stays until it is dismissed** (design-critic): it stays next to the cause in the reopened section, where
   the stored version shows. The link is hidden there. A conflict is a warning with its own text, a failed save an error.
   Link and Dismiss are `btn btn-sm min-h-11` (44 px tap targets).
5. **Not done:** placing the message below the page heading (Tab order) needs a slot in `PageHeader`; the DOM order
   matches the visual order, so it is not a WCAG failure. Left for later.
6. **Code review:** `settled()` waits at most 10 s (a save that never answers must not block other pages); a conflict
   on leaving does not reload the gone page; a later successful save in the section clears its message; a failure is
   not replaced by a weaker "dropped" report; the delayed first load is skipped when the page is already gone.
   The plain autosave of Logo and the creative settings stays hand-rolled for now: #101.
