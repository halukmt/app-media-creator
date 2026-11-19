# Design

## Decisions

1. **Composition with sharp:** background canvas, logo layers (`renderLogoSquare`) and one SVG layer with the text as
   paths (`textBlockSvg`, reusing the card font and `fitText`), so share images look like the cards and render the same
   everywhere.
2. **Default background white.** A logo colour as default hid the logo parts of that colour (seen in the visual
   check); the Logo section (#10) will offer the palette as a choice.
3. **WhatsApp preview as JPEG** with quality stepping down from 88 until it fits the catalogue's 300 KB; fails with a
   clear message otherwise.
4. **Profiles:** logo at 60 % of the side, inside the circle crop of the networks. **Banners:** logo and name centred
   in `safeArea` (YouTube) or the whole image.
5. **Logo variants** reuse `renderSilhouette` (also for opaque logos) and `renderLogoSquare`; new catalogue group `logo`.
6. **Taglines in the request** for now; storing them (and the background) belongs to the Logo section UI (#10).

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| visual check | Logo colour as default background hid the logo | major | Default background white | fixed |
| code-review | WhatsApp size and byte limit hard-coded | minor | `defaultSize` 1200×630 in the catalogue; format and limit from the spec | fixed |
| code-review | Banner text width guessed from the character count | minor | Measured with the title font | fixed |
| code-review | Email signature unreadable in dark-mode mail clients | minor | White background | fixed |
| code-review | Taglines for other languages silently dropped | minor | Taglines outside the project languages are rejected; test | fixed |
| code-review | Profile / banner chosen by aspect, special cases by id | minor | Kept: no square banner exists; a catalogue layout field comes when one does | won't fix now |
| code-review | Card renderer duplicated the text drawing | minor | Screenshot cards use `textBlockSvg` (golden images unchanged) | fixed |
| code-review | Gap constant written twice | minor | One `GAP` constant | fixed |
| code-review | Identical share images rendered per locale; logo re-fitted per image | minor | Render once per (spec, tagline); logo cached per box size | fixed |
| code-review | Plain errors for a missing variant size; JPEG message names WhatsApp | minor | Sizes via `cardSizeForSpec`; JPEG message uses the spec name | fixed |
| code-review | Taglines literal in the test file | minor | `shareTaglines()` factory | fixed |
| security-review | No findings: text only as glyph paths, colours validated, SVG logo rasterized first, locale keys checked | — | — | — |
