# Design

## Decision

Draw the bezel image twice: with `feDropShadow` first (body plus its shadow), then the screenshot, then the bezel
again without a filter. *Alternative:* a filter that outputs only the shadow (blurred, offset `SourceAlpha` with a
flood colour). Rejected: more filter markup for the same pixels; drawing the small bezel PNG twice is cheap.

The unit tests built their bezels with `dest-out` against a fully transparent shape, which removes nothing, so the
"opening" was opaque and the bug could not show. The test shapes now have alpha 1.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
