Issue: #53

# Proposal

## Why

Codex found on #52 that the lower bezel layer uses `feDropShadow`, which also draws the bezel itself. With the plain
bezel on top, the artwork is drawn twice and semi-transparent bezel pixels (anti-aliased edges, baked-in shadows)
become more opaque, changing the bezel's look in framed screenshots and store cards.

## What Changes

- The lower layer renders only the shadow: the bezel's alpha, blurred and offset, filled black at 30 %. The artwork is
  drawn once, above the screenshot.

Acceptance criteria from the issue:
- The lower layer renders only the shadow; the bezel artwork is drawn once, above the screenshot.
- Test: a semi-transparent bezel area keeps its opacity apart from the shadow beneath it.

Targets: App Store, Google Play, web. Locales: not language-specific.

## Not in this change

- Generic frames (they are drawn once already).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `screenshot-cards`: the bezel artwork of a user frame is drawn exactly once.

## Impact

- `src/core/screenshots/device.ts`; `tests/unit/framed-screenshots.test.ts`.
