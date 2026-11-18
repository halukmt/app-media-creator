# Design

## Context

The web icon generator (#8) set the pattern: `loadLogo` → render buffers → `inspectImageBytes` + `validateMedia` →
`registerOutputs` batch. `apple.icon` exists in the catalogue (1024, PNG, no alpha). No UI in this change.

## Decisions

1. **Catalogue:** new entries `apple.icon-dark`, `apple.icon-tinted` (folder `icon`, alpha allowed, `verified: false`
   because the research has no primary source for their backgrounds) and `apple.icon-layer-background` (alpha
   forbidden), `apple.icon-layer-foreground` (alpha allowed), folder `icon-composer`. None is required; each has a
   condition text explaining where it is used.
2. **Safe area:** iOS masks the 1024 canvas with a rounded square (corner radius about 22 %, roughly 229 px). A centred
   box stays inside the mask up to about 87 %; 80 % (820 px, corners at (102, 102)) is the chosen limit with a margin to
   the corners and the Liquid Glass edge. `logoScale` is clamped to 0.4–0.8, default 0.7.
3. **Rendering:** `renderLogoSquare` gains `grayscale` (sharp `greyscale()` keeps alpha). Dark appearance: the logo in
   its colours on transparency (the system draws the dark backdrop). Tinted: greyscale logo on transparency.
4. **Palette:** `logoPalette(logo)` renders the logo to 64×64, drops pixels with alpha below 128, quantizes RGB to
   4 bits per channel and returns the five most frequent buckets as hex colours. The default background stays white.
5. **API:** `POST /api/generate/app-store-icons` with `{ background?, logoScale? }` and `GET /api/logo/palette`. Both map
   `GeneratorError` to 400.

## Risks / Trade-offs

- [Dark and tinted guidance may change with new iOS versions] → entries are `verified: false` and show a warning in the
  checklist until confirmed.
- [Very wide logos look small] → acceptable; square marks come with #9.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | lstat failure on the logo escaped as 500 | minor | `loadNewestLogo` maps every non-GeneratorError to a GeneratorError | fixed |
| code-review | Palette misreads greyscale logos (2 channels) | important | Convert to sRGB before reading pixels | fixed |
| code-review | Truncated logo pixels failed later with 500 | minor | `loadLogo` decodes the logo completely once | fixed |
| code-review | Foreground rendered twice, renders sequential | minor | Reuse the transparent render, run renders in parallel | fixed |
| code-review | Validation and size helpers duplicated | minor | Shared `assertValidOutputs`, `fixedSizes`, `squareSize` in `outputs.ts` | fixed |
| code-review | No CHANGELOG line for #6 | minor | Added with the PR, as for every issue | fixed |
| code-review | Dead `svgDensity` call in the web icon generator | minor | Removed | fixed |
| code-review | Re-export of `GeneratorError` from web-icons | minor | Removed; tests import from `logo.ts` | fixed |
| code-review | 80 % described as the geometric limit | minor | Reworded as chosen safe limit (geometric limit about 87 %) | fixed |
| code-review | Colours validated in route and generator | minor | Only the generators validate; routes pass the values | fixed |
| security-review | No high-confidence findings (palette endpoint, logoScale, colours, paths, CSRF) | — | — | done |
