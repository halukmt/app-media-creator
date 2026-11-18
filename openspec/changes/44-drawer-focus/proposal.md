Issue: #44

# Proposal

## Why

Codex found two defects in the sections drawer of the app shell (#43). On narrow screens, closing the drawer with Escape
or the overlay tries to focus the menu button while the page is still inert, so focus is lost. When the window grows
past the large breakpoint with the drawer open, the page stays inert although the desktop sidebar is shown, and the
whole page cannot be used.

## What Changes

- Focus returns to the menu button after the drawer has closed and the page is interactive again.
- Entering the desktop layout closes the mobile drawer state, so the page is never inert on wide screens.

Acceptance criteria from the issue:
- Closing the drawer with Escape or the overlay returns focus to the menu button.
- Crossing the `lg` breakpoint with the drawer open leaves the page usable.
- e2e tests for both.

Targets: not target-specific. Locales: not language-specific.

## Not in this change

- Other drawer behaviour (swipe gestures, focus trap inside the menu).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell`: drawer focus return and desktop breakpoint.

## Impact

- `src/web/layouts/AppShell.tsx`; `tests/e2e/shell.spec.ts`.
