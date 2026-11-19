# Design

## Context

#11 added the card renderer with generic frames and user bezels. The manifest replaced files by
(spec, locale, position), which would make `1x` and `2x` files of the same screenshot replace each other.

## Decisions

1. **Shared device drawing** (`screenshots/device.ts`): screenshot checks (raster formats only), screen image and
   device SVG move out of `render.ts`; cards and framed screenshots use the same code. `frameSvg` gets a shadow switch.
2. **Two catalogue entries** (PNG and WebP) instead of one with two formats: each format is validated against its own
   entry and gets its own row in the export checklist. Group `mockup`, so they never appear as device models.
3. **1x size in the catalogue** (`baseWidth` 400, the device width); 2x doubles it. The height follows the
   screenshot's aspect ratio; the result is checked against the catalogue's side range before rendering.
4. **Subfolder in the set position** of the manifest: `1x` / `2x` are folders; Android densities used one position
   per density already and are unaffected.
5. **Per locale only with own screenshots**: a website in French shows French screens; fallback to the source
   language would put German screens on a French page. The export checklist shows the files per locale.
6. **File name** from the original upload name (`originalInputName` strips the upload prefix).
7. **User bezels** live in `<workspace>/frames/user/` (`Workspace.userFramesDir`), never created by the tool.

No UI in this change, so no component reuse map.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | Very tall or wide screenshots failed validation as HTTP 500 after a slow render | major | Output size checked against the catalogue range before rendering; message names the file; test | fixed |
| code-review | Broken user bezel or corrupt input surfaced as 500 | major | Every per-file failure becomes a GeneratorError naming the file (400); test | fixed |
| code-review | User bezel got the shadow margin but no shadow | minor | Same drop shadow on the bezel's shape; test | fixed |
| code-review | Deleted screenshots left stale framed files in output and ZIP | major | `registerOutputs` option `replaceSets`: the run replaces the sets of the selected locales; test | fixed |
| code-review | User bezel loaded per screenshot and scale | minor | Loaded once per run and passed in | fixed |
| code-review | Strictly serial rendering | minor | Scales render in parallel per screenshot | fixed |
| code-review | Device width bounds hard-coded in the renderer | minor | Renderer keeps only a safety bound (8192); output limits come from the catalogue (`edges`) | fixed |
| code-review | `defaultSize` height unrelated to the real output | minor | Replaced by catalogue field `baseWidth` (device width at 1x) | fixed |
| security-review | No findings: frame and locales validated, subfolder fixed, names cleaned, route behind `localOnly`, manifest key change only narrows replacement | — | — | — |
