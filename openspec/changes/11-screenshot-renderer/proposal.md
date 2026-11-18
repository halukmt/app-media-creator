Issue: #11

# Proposal

## Why

The core of the tool is store screenshots with a headline card: background, headline and subline above or below the
app screenshot in a device frame, at the exact pixel size of every device class. The old prototype rendered them in
the browser; the tool renders on the server so UI, CLI and skills produce identical pixels.

## What Changes

- A card renderer in the core library that builds an SVG and rasterizes it with sharp to an opaque PNG of exactly the
  requested size.
- Three layouts from the prototype: text on top, text on top with a larger device running off the bottom edge, and
  text at the bottom.
- Text fitting: balanced line breaks, shrinking down to half the start size, hyphenation of a word that is wider than
  the line, and warnings for overflow, hyphenated words and characters the font cannot draw.
- Text is drawn as paths from the bundled Inter font (SIL OFL 1.1), so the output does not depend on installed fonts.
  Latin and Latin Extended cover all 6 media locales, including ç ğ ı İ ş ü.
- Backgrounds: neutral solid and gradient presets, plus solid backgrounds and a gradient from the logo palette.
  The text colour (dark or white) follows the contrast with the background.
- Generic device frames drawn in code for iPhone (Dynamic Island and home button), iPhone Duo, iPad, Android phone and
  tablet, plus `none`. A user bezel in `frames/user/<kind>.png` with `<kind>.json` replaces the generic frame.
- Card defaults per spec: size (first fixed size, or a new catalogue `defaultSize` for range specs), frame (none
  where the store discourages frames) and the overlay text limit (new catalogue `maxTextShare`, 20 % for Google Play),
  with a warning when the text covers more.
- Golden-image tests for every layout in `de-DE` and `tr-TR`.

Acceptance criteria from the issue:
- Layouts "text top", "text top, large phone" and "text bottom".
- Background presets (solid and gradient) plus colours from the logo palette.
- Generic device frames for iPhone, iPhone Duo, iPad, Android phone and tablet; official bezels from `frames/user/`.
- Text fitting: auto-shrink and wrap; overflow warning; works for long German and Turkish words and ç ğ ı İ ş ü.
- Output PNG without alpha; golden-image tests for each layout in `de-DE` and `tr-TR`.

Targets: App Store, Google Play. Locales: all 6; text is passed in per locale by the caller.

## Not in this change

- Inputs per locale and the device matrix (#12), the Screenshots section UI (#14), frame-only screenshots (#13).
- Writing cards into the output folder and the manifest (with #12), the clean status bar and the logo strip of the
  prototype, landscape cards.

## Capabilities

### New Capabilities
- `screenshot-cards`: rendering store screenshot cards.

### Modified Capabilities
- `media-specs`: default render size for range specs, overlay text limit and frame advice for Google Play screenshots.

## Impact

- New `src/core/screenshots/`; `src/core/specs/types.ts`, `google.ts`; dependencies `opentype.js` (MIT) and
  `@fontsource/inter` (OFL 1.1); `THIRD_PARTY_NOTICES.md`; `.github/copilot-instructions.md` §3, §7, §8;
  `tests/golden/`.
