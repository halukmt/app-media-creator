Issue: #13

# Proposal

## Why

Websites (landing pages, docs) show app screenshots in a device frame without a store card around them. Users need
these per language, with transparency so they sit on any page background, in 1x and 2x for sharp display.

## What Changes

- A renderer that draws an uploaded screenshot in a generic device frame (or the user's bezel) on a transparent
  background, with an optional soft shadow and a margin that keeps the shadow uncut.
- A generator that writes, for every selected language with its own uploaded screenshots, PNG and WebP in `1x` and
  `2x` into `web/<locale>/framed-screenshots/<scale>x/NN-<name>.<ext>`. Languages without own screenshots are skipped.
- Catalogue entries `web.framed-screenshot` (PNG) and `web.framed-screenshot-webp` (WebP): web target, new group
  `mockup`, alpha required, device width 400 px at 1x (default size), tool-defined with no store limits.
- The output manifest treats the subfolder as part of a set position, so `1x` and `2x` files live side by side.
- API: `POST /api/generate/framed-screenshots` with optional `frame`, `shadow` and `locales`.
- Shared device drawing moved out of the card renderer; the generic frame's shadow can be switched off. The workspace
  knows the user bezel folder (`<workspace>/frames/user/`).

Acceptance criteria from the issue:
- Transparent PNG and WebP, optional shadow, sizes 1x / 2x.
- Per locale when localized screenshots exist.
- Tests for alpha and dimensions.

Targets: web / social. Locales: all 6, one, several or all; only languages with own screenshots produce files.

## Not in this change

- UI for this output (comes with the Screenshots section, #14).
- Picking the frame per screenshot; landscape devices.

## Capabilities

### New Capabilities
- `framed-screenshots`: screenshots in a device frame on transparency for websites.

### Modified Capabilities
- `export`: the subfolder is part of the set position.

## Impact

- New `src/core/screenshots/device.ts`, `framed.ts`, `src/core/generators/framed-screenshots.ts`; changes in
  `frames.ts`, `render.ts`, `src/core/specs/{types,web}.ts`, `src/core/export/manifest.ts`,
  `src/core/workspace/{workspace,inputs}.ts`, `src/server/generate-routes.ts`.
