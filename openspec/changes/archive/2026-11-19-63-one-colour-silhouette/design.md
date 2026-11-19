# Design

## Decisions

1. **Decide once per logo, from the source.** `analyseBackground` renders the source once at 512 px and returns
   a background colour only when (a) the logo has no transparency, (b) at least 60 % of its border pixels are within a
   tight distance (24) of one corner's colour (the corner most of the border agrees with), and (c) at least 0.1 % of
   all pixels differ from it by the cut tolerance (48). The result is cached per
   logo buffer (`WeakMap`), so every density, web variant and blueprint size of one run uses the same decision and
   the source is decoded for it only once (this also replaces the `stats()` decode per call).
   - *Alternative (first attempt):* count per rendered size and keep the logo whole below 1 % kept pixels. Rejected in
     review: thin line art on white is around 1 % and could flip between densities (filled square at mdpi, ring at
     xxxhdpi), and a gradient mark was still cut into a partial shape.
   - *Alternative:* a colour count from `logoPalette`. Rejected: a mark with antialiasing or JPEG noise has many
     colour buckets, so the count does not tell "one colour" from "mark on background".
2. **Border agreement** is what makes a background a background. 60 % lets a cropped wordmark that touches the edge
   keep its cut-out; the tight border tolerance keeps a gentle gradient (whose corner colour matches only a short
   stretch of the border) from counting as a flat background. Such marks keep their full square, the honest silhouette.
3. Below the tolerance, very thin strokes can still disappear at the smallest densities, as before; that is a
   property of the downscale, not of the decision.

## Review log

- **/code-review (first version, 1 % per size):** 6 findings, all addressed by the redesign above: per-size decision
  (densities could disagree), 1 % threshold too high for line art, gradient marks still cut, only the Android layer
  tested, no boundary / multi-density test, double pass and repeated `stats()` decode. New tests: web monochrome and
  inverse variants of a one-colour logo, gradient mark, thin ring at mdpi and xxxhdpi.
- **/code-review (second version):** 9 findings.
  - Fixed: 95 % border agreement turned edge-touching wordmarks into filled boxes → 60 % with the best of the four
    corners and a tight border tolerance (test: cropped wordmark); a single noisy top-left pixel decided → best corner;
    a rejected analysis stayed cached → removed on rejection; the border check walked every pixel → border offsets,
    and the alpha and mark checks share one pass.
  - Accepted: thin strokes below the tolerance can still vanish at the smallest densities (unchanged behaviour of the
    downscale; a centred 2 % ring stays visible at mdpi, tested); the cut is a global colour key, so white details
    inside a mark on white are cut too (unchanged; a flood fill would instead fill the inside of rings and outlined
    letters); one extra 512 px decode per logo for the analysis (cached per run).
  - Not applicable: the de-DE / tr-TR renderer rule targets text; the logo variants are shared and have no text.
