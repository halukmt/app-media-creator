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
