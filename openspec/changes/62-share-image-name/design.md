# Design

## Context

`cardFont().path()` placed glyphs one by one and called `glyph.getPath(...).toPathData(2)`. In opentype.js 2.0.0,
`roundDecimal` computes `Math.round(decimalPart + "e+" + places)`; a decimal part such as `5.7e-14` becomes the string
`"5.7e-14e+2"`, which is `NaN`, and the value is cached per decimal part.

## Decisions

1. **Write the path data ourselves** from `path.commands` (M, L, Q, C, Z) with `toFixed(2)` and trailing `.00`
   removed. *Alternative:* patch or upgrade opentype.js. Rejected: no fixed release; a local patch is fragile.
   *Alternative:* pre-round x, y and size. Rejected: the float noise comes from glyph-unit scaling inside opentype.
2. The serialiser does not apply opentype's optimisation (dropping a final `L` before `Z`); rendering is identical and
   the golden images are unchanged.

## Review log

- **/code-review:** fixed — non-finite or absurd coordinates throw instead of drawing to (0,0) (also keeps the
  "never exponent notation" guarantee); shortest number form without `-0`; exhaustive switch that throws on unknown
  command types; a unit test fails when `toPathData` / `toSVG` is called anywhere in `src/`; named layout constants in
  the font regression test. Not changed: the ink-width check in the share test scans right of the logo for near-white
  pixels; the test logo is a two-colour PNG, so it cannot add false ink.
