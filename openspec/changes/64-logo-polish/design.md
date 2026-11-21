## Context

Issue #64 collects small follow-ups from the reviews of #10. All of them reuse existing parts.

## Decisions

- **Note once per pack.** The checklist message gets `code: 'unverified-spec'`, so the UI does not match text.
  `cardStatus()` drops it from card messages and recomputes the card state from the remaining messages; pages show
  one muted line of text (the pattern of the Video poster note) under the pack heading when a file of the pack is
  unverified; design-critic found an info alert per pack louder than the task.
  Rejected: a warning alert per pack (too loud for a static note).
- **Reuse map (component-architect).** Note → muted `<p>` like `posterNote`; srcSet → `PreviewCard` `media`
  unchanged; label → `BusyButton` children; current logo → `PreviewCard` `size`, `status`, `messages`. No new component,
  no INVENTORY change.
- **Logo checks.** `describeLogo()` compares the shorter side of a raster logo with the App Store icon side from the
  specs catalogue (`apple.icon`), and warns for non-square logos. SVG logos scale without loss.
- **Preview cache.** In-memory LRU (32 MB) keyed by path, file size, change time and variant. A replaced file has a
  new key, so an old preview is never served. Browser caching stays `no-store`; the safe headers are unchanged.
- **Safe headers.** `safeMediaHeaders(type)` returns content type, `nosniff`, sandbox CSP and `no-store`. The ZIP
  download keeps its own attachment headers.

## Risks

- The cache holds up to 32 MB per route group in memory. Bounded; fine for a local tool.
