# Design

## Context

Logos are uploaded to `inputs/logo/` (#3); outputs are registered with `registerOutput()` (#5, #35). `inspectImage`
uses sharp, which cannot read ICO. Web favicon entries exist in `src/core/specs/web.ts`. No UI in this change.

## Goals / Non-Goals

**Goals:** a self-contained generator module that later generators (#6, #7, #9) can follow as a pattern.
**Non-Goals:** colour extraction from the logo, preview / production variants.

## Decisions

1. **Generator module `src/core/generators/web-icons.ts`** with `generateWebIcons(workspace, options)`. Shared helper
   `renderLogoSquare(logo, size, { background, padding })` (sharp: SVG at high density, `fit: contain`, composite on a
   flat background or transparent) in `src/core/generators/render.ts` for reuse by #6, #7, #9.
2. **Spec additions:** `SpecEntry.folder?: string` overrides the folder segment; the favicon entries and the two new
   document entries (`web.webmanifest`, `web.head-snippet`) use `favicons`. `MediaKind` gains `document`, formats gain
   `json`, `html`, `txt`, `DimensionRule` gains `{ kind: 'none' }`. The checklist does not measure documents; it only
   checks that they exist.
3. **ICO:** written by hand (ICONDIR + one PNG image per size, 32 bpp). Measured by parsing the ICONDIR in
   `inspectImage` when the file starts with `00 00 01 00`; the largest entry gives width and height.
4. **icon.svg:** a 512 viewBox with a rounded background `rect` (class `bg`, colour switched by
   `@media (prefers-color-scheme: dark)`) and the logo as an `<image>` with a data URI (the original SVG, or a PNG for
   raster logos). Embedded images render in image mode, so scripts in an uploaded SVG never run.
5. **Sizes:** touch icon logo box 140 px on 180 (Apple guidance), manifest icons transparent with a 6 % margin,
   maskable icon logo box 290 px (the square inside the 409 px safe circle).
6. **Path guard:** `registerOutput` throws when the path is registered for another spec id.
7. **API:** `POST /api/generate/web-icons` with `{ background?, darkBackground?, themeColor? }` (hex colours validated),
   behind `localOnly()`; returns the registered entries.

## Risks / Trade-offs

- [Embedded data URI images in favicon SVGs] → supported by current Chrome, Firefox and Safari; `favicon.ico` stays the fallback.
- [Very wide logos look small in square icons] → acceptable; a square-mark variant comes with #9.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | JSON `null` body → 500 (also in export route) | minor | Shared `readOptionalJsonObject` helper, 400 for non-objects | fixed |
| code-review | SVG density from target box only; large SVGs exceed sharp's pixel limit | important | Density from the SVG's intrinsic size (`svgDensity`) | fixed |
| code-review | Sizes hard-coded in the generator | important | Sizes, safe area and ICO sizes read from the catalogue | fixed |
| code-review | Files registered without validation | important | Render all, validate with `inspectImageBytes` + `validateMedia`, then register | fixed |
| code-review | Non-atomic registration leaves mixed sets | important | `registerOutputs` batch: all paths checked before writing, manifest written once | fixed |
| code-review | Newest logo by file name, not by time | minor | Newest by modification time; only regular files | fixed |
| code-review | Corrupt logo → 500 | minor | `GeneratorError` → 400 with a clear message | fixed |
| code-review | Manifest read twice per registration | minor | Covered by the batch (one read per batch) | fixed |
| code-review | Old favicon paths dropped after moving to `favicons/` | minor | No earlier generator existed, so no workspace has the old paths | rejected |
| code-review | Duplicate JSON body parsing | minor | Shared helper | fixed |
| security-review | No high-confidence findings (SVG embedding, librsvg external refs, ICO parser, paths) | — | — | done |
| security-review | Hardening: colours validated only in the route; symlinked logo | hardening | Generator validates colours; logos must be regular files | fixed |
