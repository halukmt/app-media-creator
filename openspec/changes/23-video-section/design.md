# Design

## Reuse map (component-architect)

- No new component; no new INVENTORY row (TextField, FileField and PreviewCard rows updated).
- Frame, steps, locale bar: `SectionLayout` (own `unavailableHint`); empty state `SectionEmptyState section="video"`.
- Upload: `LocaleSelector mode="single"`, `FileField`, `ProgressStatus` and `StatusAlert` in live regions.
- Recordings and results: `PreviewCard` (it is the list item itself), results with a `<video>` as media and the
  `StatusBadge` from the export checklist via `useOutputStatuses` (moved out of LogoPage).
- Purpose: `OptionGroup variant="card"`, promo reel `disabled` with the note "Comes later".
- Trim: `TextField` with the new `inputMode="decimal"` (stays `type="text"`; rejected: `type="number"` changes on
  scroll and depends on the browser's decimal mark; `range` has no two handles and is not precise).
- Card length: `OptionGroup` chips 1–5 s. Texts: `LocaleTextFields`. Formats: `OptionGroup multiple`. Frame:
  `OptionGroup` with the shared `FRAME_KINDS` (`lib/frames.ts`) plus "No frame".
- Loop: an info `StatusAlert` with a link to Screenshots; no second phrase editor (two editors of the creative
  settings would conflict).

## Decisions

1. **Step 3 is "Options", not "Preview and edit".** A video preview takes about half a minute per video and language
   to render, so there is no instant preview while editing; the rendered videos are shown in Export. The label says
   what the step holds.
2. **One generate request for the selected languages.** The generators encode a recording only once for languages
   that share it and the same texts (#21); one request per language would undo that. Progress is a spinner with the
   languages in a live region.
3. **Sizes and lengths from the catalogue.** The purpose hints and the result cards use `catalogue.videos`
   (`GET /api/catalogue`), never sizes written into UI text.
4. **MP4 with byte ranges.** `<video>` needs `Range` responses to seek, and Safari to play; invalid ranges are ignored
   (RFC 9110), unsatisfiable ones get 416.
5. **Accessibility.** Each player has an `aria-label` (asset and language) and an empty captions track: the
   recordings have no speech. The reasons why "Make" is off stand next to the button, not in a live region.
6. **Settings.** `video.json` holds the purpose, trim, card texts and device video options; the trim fields are
   filled from the first load only, so later reloads (after an upload) never overwrite unsaved edits.

## Not in this change

- Promo reels (#22); a preview player for uploaded recordings (the input route serves screenshots only); per-language
  trims.
