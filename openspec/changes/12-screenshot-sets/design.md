# Design

## Context

#11 renders one card; #13 added `replaceSets` for whole-set replacement and per-locale website screenshots. Uploads are
stored per locale with an upload-time prefix, so a name sort is the upload order.

## Decisions

1. **Device matrix as catalogue data** (`specs/matrix.ts`), used by `deviceOptions`. The renderer supports portrait
   phones and tablets only; offering Mac/TV/Watch would produce errors. *Alternative:* keep all screenshot specs and
   skip unsupported ones at generation. Rejected: users would pick devices that silently produce nothing.
2. **One JSON document** `screenshots.json` (style + sets) with a single `PUT`. Reordering, text edits and style
   changes are one save; the UI (#14) sends the whole document. Entries reference inputs by workspace path.
3. **Merge on read** (`mergeWithInputs`): the document is reconciled with the uploads each time it is read, so uploads
   and deletions need no extra bookkeeping. A broken file falls back to defaults instead of blocking the section.
4. **Fallback = the whole source set** (screenshots and texts) for a locale without an own set. A locale can still own
   a set that references source screenshots with its own texts; such entries are marked fallback input as well.
5. **Max 10 per set** (App Store maximum); each device takes up to its catalogue `maxCount` (Play 8).
6. **One batch per locale** with `replaceSets` over the generated devices: keeps memory bounded (one locale's PNGs at a
   time) and removes cards of deleted screenshots. User bezels are loaded once per frame kind per run.
7. **Warnings** from the renderer (overflow, hyphenation, text share) are returned with the computed output path.

No UI in this change, so no component reuse map.

## Risks / Trade-offs

- [Generating all 6 locales × 9 devices × 10 screenshots is 540 full-size renders] → acceptable for a local tool; the UI
  (#14) offers one locale / several / all.
- [Fallback locales get the source texts] → the checklist warns; AI copy (M3) will fill per-locale texts.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
