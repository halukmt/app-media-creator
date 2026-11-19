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

- Results of `/code-review` are recorded here after the review.
