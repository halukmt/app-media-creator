# Design

## Context

#11 added the card renderer with generic frames and user bezels. The manifest replaced files by
(spec, locale, position), which would make `1x` and `2x` files of the same screenshot replace each other.

## Decisions

1. **Shared device drawing** (`screenshots/device.ts`): screenshot checks (raster formats only), screen image and
   device SVG move out of `render.ts`; cards and framed screenshots use the same code. `frameSvg` gets a shadow switch.
2. **Two catalogue entries** (PNG and WebP) instead of one with two formats: each format is validated against its own
   entry and gets its own row in the export checklist. Group `mockup`, so they never appear as device models.
3. **1x size in the catalogue** (`defaultSize.width` 400, the device width); 2x doubles it. The height follows the
   screenshot's aspect ratio, so the default height only satisfies the rule.
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
