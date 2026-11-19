# Design

## Context

Specs with safe areas existed in `src/core/specs/apple.ts`. The card renderer, device frames, backgrounds, screenshot
sets with source fallback and the save queue were reusable. The Screenshots section had a disabled "header" purpose.

## Decisions

1. **Composition.** Key art = phrase (left, bold, fitted with the card text fitter) and one device (right) inside the
   safe area with a 6 % inner margin; without a phrase the device is centred. Auxiliary area = a row of devices of the
   key device's size, gap 35 %, fading from 70 % to 20 % opacity towards the edges, cut off at the image edge. The
   phrase start size is the smaller of 17 % of the safe height and the text box width / 9, so the narrow universal
   safe area shrinks long German words instead of hyphenating them.
   - *Alternative (first render):* one large device per side. Rejected after looking at the output: the sides dwarfed
     the key art.
2. **Pure layout function** `creativeLayout`, so "key art inside the safe area" is tested for all three specs without
   rendering; a render test checks that changing the phrase changes pixels only inside the safe area.
3. **Own shadow.** librsvg's blur filter took 22 s for the universal image; a rounded rectangle blurred by sharp at a
   quarter size and embedded as an image takes milliseconds (all six images of two locales: about 10 s).
4. **Search size 3840×2560** via a catalogue `defaultSize`, because Apple gives the safe area for that size.
5. **Settings in their own file** (`creative.json`) like `logo.json`, not inside `screenshots.json`: different
   lifecycle and validation.
6. **UI** per the component-architect reuse map: purpose option enabled (disabled with a note when the App Store is
   off); `LocaleTextFields` (new, also replaces the Logo taglines loop); `PreviewCard.guide` (dashed `aria-hidden`
   rectangle in percent, safe-area size also as text); one "Show safe area" toggle; generation one request per locale.
   - *Rejected:* a separate `SafeAreaGuide` component (one optional prop suffices); a `HeaderWorkflow` component
     (a stateful page-in-a-component across three steps).
7. `deviceSvg` takes an `id` prefix, so several devices in one SVG get unique clip-path and filter ids.

## Reuse map (component-architect)

| Part | Reused |
|---|---|
| Purpose, background | `OptionGroup` (card variant, swatches via `backgroundChoices` / `swatchCss`) |
| Phrases | new `LocaleTextFields` (via `TextField`) |
| Previews | `PreviewCard` with new `guide` prop, grid `sm:grid-cols-2 lg:grid-cols-3` |
| Toggle, status, generate | `ToggleField`, `StatusAlert`, `BusyButton`, `ProgressStatus` |

## Review log

- **/code-review:** 8 findings. Fixed: the header preview kept skeletons (or old previews under a new language's alt
  text) when the language has no screenshots → previews are cleared first and an info alert asks for screenshots;
  only the first screenshot passed the raster-format check → all three are checked; a failed settings load hid the
  options silently → error alert with Retry; the stored creative background was offered only while the sets were
  loaded → independent of them; the guide could reach past the image → width and height clamped to the rest of the
  image; the phrase limit and the creative sizes were copied into the UI → served by `/api/catalogue`
  (`creativeImages`, `maxPhrase`). Accepted: each side device re-resizes its screenshot and embeds the user bezel
  again (universal image about 2 s, fine for a local tool); the third copy of the autosave pattern → noted on #64
  (`useAutosave` hook).
- **security-review:** no findings (routes behind `localOnly()`, phrase drawn as paths, colours validated, every
  coordinate through `svgNumber`, screenshots only from validated set entries and re-encoded by sharp).
- **design-critic:** 5 findings. Fixed: a failed preview kept its loading skeleton → no media on failure; skeletons
  had the wrong shape → aspect ratio from the catalogue size; the safe-area hint showed while the guide was off.
  Accepted: `LocaleTextFields` keeps the `h3 text-lg` heading the Logo taglines had; the length hint repeats per
  field (one field per language, short text).
