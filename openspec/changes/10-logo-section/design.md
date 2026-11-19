# Design

## Context

Generators for all logo packs exist (#6–#9) and write into the output manifest. The Screenshots section (#14)
established the section pattern: `SectionLayout` with steps and locale bar, `OptionGroup` for every choice,
`PreviewCard` for the L4 grid and `createSaveQueue` for autosave.

## Goals / Non-Goals

**Goals:** one screen for all logo packs; reuse the Screenshots patterns without new components.

**Non-Goals:** icon variants (#34), per-pack backgrounds, a free colour picker.

## Decisions

1. **Settings in `logo.json`** (packs, background, taglines), read leniently like `screenshots.json`.
   *Alternative:* fields in `project.json`. Rejected: project settings are strict and shared by all sections.
2. **One generate route per pack** (`POST /api/generate/logo/:pack`) that reads the stored settings. The UI calls it
   once per chosen pack and shows progress per pack; a failure is reported and the next pack runs.
   *Alternative:* one route for all packs. Rejected: no progress and one failure stops everything.
3. **Preview through `GET /api/output/file`** limited to manifest images that `locateOutputFile` reports as own
   files, downscaled on the server to 240 px. *Alternative:* serve the output folder statically. Rejected: would
   expose every file, including symlinks, and send full-size banners to the grid.
4. **Group the grid per asset and language** (`groupOutputs` in `src/web/lib/logo.ts`): densities of one launcher
   icon and the sizes of the manifest icon become one card with the largest image and "N files · min–max px wide".
   This took the 375 px preview from 11 453 px to 8 040 px. *Alternative:* one card per file. Rejected: about 60 cards.
5. **Backgrounds offered:** server presets plus logo palette, solid only; a stored colour that is no longer offered
   stays visible as "Current background" (`backgroundChoices`, shared with Screenshots).

## Reuse map

| Need | Reused |
|---|---|
| Steps, locale bar | `SectionLayout` (new optional locale-bar hint) |
| Logo upload | `FileField`, `PreviewCard` |
| Packs, background | `OptionGroup` (card and chip variants; new optional `swatch`) |
| Taglines | `TextField` |
| Generate | `BusyButton`, `ProgressStatus`, `StatusAlert` |
| Preview grid | `PreviewCard` (media and size now optional for documents), `StatusBadge` |
| Empty state, Export step | `SectionEmptyState`; link to the Export section |

No new components.

## Risks / Trade-offs

- The Social pack writes about 20 shared formats plus 3 per language, so the preview stays long; grouping per pack
  with headings keeps it scannable.
- `GET /api/output/file` resizes on every request (`no-store`); fine for a local tool with a 240 px preview.

## Review log

- Design-critic, `/code-review` and `security-review` results are recorded below after the reviews.
