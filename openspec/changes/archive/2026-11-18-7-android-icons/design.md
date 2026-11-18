# Design

## Context

Generators follow the pattern of #8/#6 (`loadNewestLogo`, render, `assertValidOutputs`, `registerOutputs`). The
catalogue has `google.icon` (512, PNG, alpha allowed, ≤ 1024 KB), `google.adaptive-icon.{foreground,background,
monochrome}` (108–432 px) and `google.launcher-icon` (48–192 px). `outputPath()` has no subfolders yet.

## Decisions

1. **Subfolder in the output layout:** `OutputPathOptions.subfolder` (pattern `^[a-z0-9][a-z0-9-]{0,40}$`) adds one
   folder level after the asset segment; `OutputEntry.subfolder` stores it and `checkEntry` recomputes it. Set
   positions stay `(spec, locale, order)`; the Android generator uses the density index as order.
2. **Catalogue:** adaptive layers, `google.launcher-icon` and the new document `google.adaptive-icon.xml` (format `xml`,
   new document format) get `folder: 'android-res'`. Density names live next to the size arrays in `google.ts`
   (`ANDROID_DENSITIES`), so the generator never hard-codes sizes.
3. **Play icon:** `renderLogoSquare` with background, logo box `clampLogoScale` (shared with #6), then `ensureAlpha()`
   because Play asks for a 32-bit PNG; fully opaque.
4. **Foreground safe zone:** the safe zone is a 66 dp circle; the logo box is 66/√2 ≈ 46.7 dp (rounded down to whole
   pixels), so even a square logo's corners stay inside it.
5. **Monochrome:** the logo's coverage filled with one colour (white), via sharp `extractChannel('alpha')` joined to a
   white RGB canvas. For logos without transparency the colour of the first covered pixel (the logo's top-left corner)
   counts as background and is cut out.
6. **Legacy icon:** the logo (70 % box) on the background colour, full square.
7. **Bounded SVG decode (Codex on PR #40):** `loadLogo` decodes SVGs at the density for a 1024 px box instead of the
   intrinsic size and rejects canvases that stay above 8192 px even at 1 dpi; raster logos are still decoded fully
   (their size is limited by the 10 MB upload and sharp's pixel limit). The Android generator rasterizes the logo once
   at 512 px and renders every density from that raster.

## Risks / Trade-offs

- [Expo projects use one 1024 px foreground image instead of density folders] → follow-up issue for an Expo export.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| Codex (PR #40) | Full SVG decode check rasterized huge declared canvases | important | Decode SVGs at the density of a 1024 px box; reject canvases beyond 8192 px at 1 dpi | fixed |
| code-review | 48 dp box lets square logo corners leave the 66 dp safe circle | important | Box 66 / √2 dp (rounded down); test checks the circle | fixed |
| code-review | Old launcher paths dropped after moving to `android-res` | minor | No earlier generator wrote launcher icons, so no workspace has the old paths | rejected |
| code-review | Monochrome of an opaque logo is a full square | important | Corner colour of opaque logos counts as background | fixed |
| code-review | Non-text `subfolder` accepted from a hand-edited manifest | minor | Entries with a non-text subfolder are dropped and reported | fixed |
| code-review | Density size not matched to its mipmap folder in the checklist | minor | Generator builds sizes from the catalogue per density; no generic check | accepted |
| code-review | Wall-clock assertion in a test | minor | Replaced by deterministic tests (large and absurd SVG canvases) | fixed |
| code-review | Test data built inline | minor | Shared `tests/factories/logos.ts` | fixed |
| code-review | Duplicate logoScale handling in two routes | minor | `iconOptions` helper | fixed |
| code-review | Logo decoded 21 times in parallel | minor | `rasterizeLogo` once at 512 px, renders work on that raster | fixed |
| code-review | SVG density clamp of 1 dpi leaves huge canvases unbounded | important | Covered by the canvas limit above | fixed |
| security-review | No findings (subfolder pattern, manifest re-check, ZIP, static XML, route input) | — | — | done |
| security-review | Pre-existing: writes and deletes could follow a linked folder in `output/` | hardening | Real path of every target folder must be inside `output/`; old files are deleted only when they really lie inside | fixed |
