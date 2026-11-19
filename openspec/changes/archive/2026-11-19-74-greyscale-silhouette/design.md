# Design

## Decisions

1. **One reader for all pixel loops.** `readRgba(pipeline)` appends `toColourspace('srgb')`, `ensureAlpha()` and
   `raw({ depth: 'uchar' })` and checks `data.length === width × height × 4`. `logoPalette`, `analyseBackground`
   and `renderSilhouette` read through it, so a new loop cannot forget the conversion (the cause of this issue).
   - *Alternative:* only add `toColourspace('srgb')` in `analyseBackground` (first version). Rejected in review: the
     silhouette cut and the palette kept their own copies of the pipeline.
2. The length check throws a plain `Error`: it guards an internal invariant, not user input, and should never fire.
3. The probe with sharp 0.35.5 gave 4 raw channels for 8-bit and 16-bit greyscale PNGs and a greyscale JPEG even without
   the conversion; the change is hardening, so the CHANGELOG lists it under Changed.

## Review log

- **/code-review (first version):** 8 findings. Fixed: the regression test passed on the old code and did not reach
  the guard → `readRgba` test with 16-bit greyscale input; `renderSilhouette` read RGBA without conversion → shared
  helper; the guard checked only the channel count → buffer length; duplicated pipeline → helper; hard-coded test
  coordinates → derived from the logo box; the CHANGELOG claimed a fix → Changed. Accepted: plain `Error` instead
  of `GeneratorError` (internal invariant).
- Local runs: one full `npm test` hit the known 20 s timeout of #72; the rerun was green (359 tests).
