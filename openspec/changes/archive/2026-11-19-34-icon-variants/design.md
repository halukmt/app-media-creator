# Design

## Context

The icon generators (#6, #7, #8) write one production set into `<target>/shared/…`. The manifest position is spec,
locale, subfolder and order, and the checklist groups files by spec. The Logo section (#10) shows outputs grouped per
spec and locale.

## Decisions

1. **Environment as a top-level folder** under the target: `apple/preview/icon/…`.
   - Locale folders are mixed case (`de-DE`) and environment ids are lower-case, and `shared` is reserved, so the
     two never collide.
   - Each folder can be copied as it is, e.g. `google/preview/android-res` into `app/src/preview/res`.
   - *Alternative:* a folder suffix (`icon-preview`). Rejected: `icon` plus `-composer` would collide with the
     existing `icon-composer` folder.
2. **Label at the bottom centre inside a safe circle** instead of a corner ribbon. iOS rounds the corners, Android
   masks to circles or squircles, and adaptive layers only guarantee the inner 66 dp, so a corner label is cut off.
   - The pill is sized from the circle radius: centre at 0.5 + 0.62 r, height 0.3 r, maximum width 1.2 r.
   - The text is drawn as glyph paths with Inter 800 and shrinks to fit.
   - Icons under 64 px get a colour bar, because text is unreadable at that size.
3. **Blueprint outline:** the silhouette alpha (`renderSilhouette`) minus its erosion. The erosion is a blur that
   stays above 200 only well inside the shape. The inside keeps 18 % so filled logos stay recognisable. It is drawn
   over an SVG gradient with a 16-cell grid (every fourth line stronger).
4. **One batch per generator with `replaceSets`** over all its specs. The run writes production and every configured
   environment, so files of removed environments are deleted and production files are rewritten unchanged.
5. **Colour presets as data from the catalogue** (`environmentColors`), so the UI shows swatches without copying the
   hex values.
6. **Checklist:** environment sets are their own items (`environment` field, not required). `groupBySpec` keys
   on spec + environment, and ChecklistCard marks them with a `RequiredBadge` label "Environment: preview".

## Reuse map (component-architect)

| Need | Reused / new |
|---|---|
| Environment block | **New `EnvironmentCard`** (`card card-sm`, border-base-300): up to 5 identical blocks with heading, remove action and field errors |
| Folder name, label | `TextField` |
| Colour | `OptionGroup` chips with `swatch` |
| Style | `OptionGroup` card variant with descriptions |
| Environment marker in the checklist | `RequiredBadge` with a label |
| Logo preview | `PreviewCard` title suffix, grouping key with the environment |

Rejected for the block: a TargetCard mode, SlotEditor (each shares only the frame), inline markup in the page, a table.

## Risks / Trade-offs

- The default `preview` environment roughly doubles the icon files of every project. Users remove it in the Project
  screen if they do not need it.
- Themed Android icons of a variant look like production. They are one colour by definition, so this is documented.

## Review log

- **security-review:** no findings ≥ 8. Verified:
  - environment ids are regex-checked and re-derived in `checkEntry`;
  - deletions only of own files of the given specs;
  - badge text drawn as glyph paths;
  - manifest name via `JSON.stringify`.
- **/code-review:** fixed:
  - Stale variant sets. The checklist warns about environments no longer in the project, and the ZIP leaves them
    out. A configured environment without files is reported once the asset has variants.
  - Ids equal to a lower-case language code (`de-de`) are reserved, because on case-insensitive file systems they
    are the locale folder.
  - Variant rows no longer say "Shared".
  - The upper-cased badge is cut to the limit (ß becomes SS).
  - The maskable label radius comes from the catalogue's safe area. The adaptive radius sits next to the existing
    66 dp constant.
  - Blueprint background and outline are cached per size.
  - The badge limit comes from the catalogue.
  - The Add button looks disabled at the limit.

  Not changed:
  - One shared "register full set" helper for the three generators (three short identical calls).
  - icon.svg of a variant embeds a raster: no dark-mode switch, and the label needs the rendered pill.
  - Style list and new-environment presets in the UI (texts are per style anyway).
- **design-critic:** fixed:
  - The Logo preview shows one icon set at a time (OptionGroup "Icon set": Production, then the environments in
    project order), so the grid no longer grows with every environment.
  - The checklist lists environments in project order.
  - The Add button is styled as disabled and linked to the limit hint ("5 of 5 environments…").
  - The add / remove note is visible.
  - No empty list.
  - Fields sit side by side by card width (`@container`).
  - Blue label on blueprint: white pill with blue text.
