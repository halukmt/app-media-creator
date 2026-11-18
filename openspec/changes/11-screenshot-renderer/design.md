# Design

## Context

The plan named satori → resvg → sharp for server-side rendering. Both satori and `@resvg/resvg-js` are MPL-2.0,
which is not on the allowed licence list (MIT, Apache-2.0, BSD, ISC). sharp (Apache-2.0, libvips LGPL) already
renders SVG in the logo generators. The prototype (`legacy/canvas.jsx`) defines the three layouts as shares of the card.

## Goals / Non-Goals

**Goals:** identical pixels on every machine; all 6 locales including Turkish; pure, testable layout logic.
**Non-Goals:** writing outputs and manifest entries (with #12); UI (#14); landscape cards; status bar cleanup.

## Decisions

1. **SVG → sharp, text as paths (opentype.js, MIT).** We build one SVG per card and rasterize it with sharp.
   opentype.js turns text into path data, so no system fonts are involved. *Alternatives:* satori + resvg (MPL-2.0,
   against the licence rule); SVG `<text>` through librsvg (depends on fontconfig and installed fonts, so the
   pixels differ between machines).
2. **Inter from `@fontsource/inter` (SIL OFL 1.1)**, weights 800 (headline) and 500 (subline), Latin + Latin Extended
   WOFF files. Each character takes its glyph from the first file that has it. Glyphs are placed one by one, because
   opentype.js 2.0 throws on Inter's contextual substitution table (ccmp, lookup type 6 format 2). That means no
   ligatures and no kerning, which headlines at these sizes do not need. The rule in §8 now says fonts may be OFL.
3. **Text fitting** (`text-layout.ts`, measure function injected): greedy wrap with explicit `\n`; a balanced wrap
   (narrowest width with the same line count); shrinking headline and subline together in 5 % steps down to 50 %;
   at the smallest size, a word wider than the line is hyphenated.
4. **Layouts as shares** of the card (`layouts.ts`), taken from the prototype. A fully visible device is made narrower
   when it would cross its bottom limit, which keeps wide iPad screens inside the card.
5. **Frames drawn in code** (`frames.ts`) with parameters per kind (bezels, radii, cutout), so they fit any screen size
   and the screenshot's own aspect ratio. A user bezel (`frames/user/<kind>.png` + JSON screen rectangle) replaces
   them. The rule in §7 now says generic frames live in code, not in `frames/`.
6. **The screenshot is resized with sharp** to the screen rectangle (cover, anchored at the top) and embedded as a PNG
   data URI. sharp runs with `unlimited: true` for this SVG only, because we build it ourselves.
7. **Catalogue fields:** `defaultSize` (render size for range specs), `maxTextShare` (0.2) and `discouragesFrames` for
   Google Play screenshots. `cardDefaultsForSpec` turns them into card settings, so no store value sits in the renderer.
8. **Golden images** at 295×640 for 3 layouts × `de-DE`/`tr-TR` in `tests/golden/`. Comparison allows a mean
   difference under 1.5 and fewer than 0.5 % of values changed by more than 48, to absorb anti-aliasing differences
   between platforms. Regenerate with `UPDATE_GOLDEN=1`. Actual renders are written to `test-results/cards/`.

No UI in this change, so no component reuse map.

## Risks / Trade-offs

- [No kerning] → Inter's default spacing is even; revisit if a user notices.
- [Large data URIs] → the screenshot is downscaled to the screen size first.
- [Golden images differ between platforms] → sharp ships the same libvips/librsvg everywhere; tolerance covers the rest.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
