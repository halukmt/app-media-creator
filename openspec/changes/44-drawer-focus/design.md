# Design

## Context

`AppShell` drives the DaisyUI drawer checkbox from React state `open` and marks the page `inert` while it is open.
`close(true)` called `setOpen(false)` and focused the menu button in the same tick, before React removed `inert`.

## Decisions

1. **Focus after commit:** `close(returnFocus)` stores the wish in a ref; an effect on `open` focuses the menu button
   once `open` is false (the commit has removed `inert`). Navigation closes without the wish, because the page
   heading takes focus.
2. **Breakpoint:** a `matchMedia('(min-width: 64rem)')` listener (Tailwind `lg`) sets `open` to false when the wide
   layout starts. *Alternative:* `inert` only below `lg` via CSS. Rejected: `inert` is an attribute, not a style, and the
   stale `open` state would come back when the window shrinks again.

No new components; the reuse map of #4 applies.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
