Issue: #51

# Proposal

## Why

Codex found on #50 that the drop shadow of a user bezel is drawn after the screenshot. The shadow is cast from the
bezel's shape, including the inner edge of the transparent screen opening, so it darkens the screenshot near its
edges, in framed website screenshots and in store cards that use a user bezel.

## What Changes

- The user bezel is drawn twice: once with the shadow filter beneath the screenshot, and once without a filter on top.
  The shadow inside the opening is covered by the screenshot; the shadow outside the device stays.
- The test bezels in the unit tests now really have a transparent screen opening (they were opaque before).

Acceptance criteria from the issue:
- The shadow is drawn beneath the screenshot and the unfiltered bezel on top.
- Test: screenshot pixels next to the inner edge of the opening are not darkened.

Targets: App Store, Google Play, web. Locales: not language-specific.

## Not in this change

- Generic frames (their shadow comes from the outer body shape and is drawn before the screen already).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `screenshot-cards`: the shadow of a user bezel never covers the screenshot.

## Impact

- `src/core/screenshots/device.ts`; `tests/unit/framed-screenshots.test.ts`, `tests/unit/screenshot-cards.test.ts`.
