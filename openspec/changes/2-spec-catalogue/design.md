# Design

## Context

`src/core/` contains only `package-info.ts` so far. The research file `.claude/research/2026-11-18_store-media-specs.md`
holds all sizes. Requirements are in `specs/media-specs/spec.md` and `specs/media-locales/spec.md`.
No UI work, so no component reuse map is needed.

## Goals / Non-Goals

**Goals:**
- Data and pure functions only; the catalogue is plain typed data that later generators import.
- One place to add a device class or a social network without touching code elsewhere.

**Non-Goals:**
- Video inspection (ffprobe) — the validator accepts duration and frame rate, measuring them comes in #20.
- Persisting or editing the catalogue at runtime.

## Decisions

1. **Data as TypeScript modules, split by target** (`apple.ts`, `google.ts`, `web.ts`) plus `types.ts`, `catalogue.ts`
   (lookup, filter), `validate.ts` (pure validation) and `inspect.ts` (sharp-based measuring).
   *Alternative:* one JSON/YAML file. Rejected: no type checking of entries and no comments with sources.
2. **Dimension rules as a union:** `{ kind: 'fixed', sizes: [{w,h}], orientations }` for exact sizes (screenshots, icons)
   and `{ kind: 'range', min, max, aspect }` for ranges (search results, Play screenshots, tablets).
   Landscape variants are derived by swapping when `orientations` includes `landscape`, so entries list portrait sizes once.
   Play's "long side ≤ 2× short side" is expressed as `aspect: { maxRatio: 2 }`; fixed ratios as `aspect: { ratio: 1.5, tolerance }`.
3. **Alpha rule as `'forbidden' | 'allowed' | 'required'`.** Store screenshots and Play feature graphic forbid alpha;
   Play icon allows it; frame-only web images will require it later.
4. **Stable asset ids** like `apple.screenshot.iphone-6.3`, `google.icon`, `web.og-image`. Ids are the contract with
   later generators and the export folder layout.
5. **Validator returns a list of violations** (`{ rule, message }`), never throws for invalid files, so the export
   checklist can show all problems at once. Measuring (`inspect.ts`) is separate and throws for unreadable files.
6. **`sharp` for measuring.** It is needed for rendering anyway (#6–#9, #11), reports format, size and alpha in one call.
   *Alternative:* `image-size` (lighter, but no alpha detection).
7. **Locales as a frozen array in catalogue order** with `resolveLocales('all' | id | id[])`.

## Risks / Trade-offs

- [Spec values change at Apple or Google] → every entry carries `sourceUrl` and `verified`; the research file has the date.
- [Unverified social sizes] → `verified: false`; the export checklist (#5) will show a warning, not an error.
- [sharp native binaries on CI or user machines] → sharp ships prebuilt binaries for Windows, macOS and Linux; CI runs on Ubuntu.
- [Fixed iPad 11" list is long] → kept as data; fine for lookups.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | 59.94 fps rejected for 30/60 fps entries (tolerance 0.05) | important | Absolute tolerance 0.1 fps; test for 29.97 and 59.94 | fixed |
| code-review | sharp cannot read ICO, so `web.favicon-ico` cannot be measured | important | Favicon generator (#8) measures ICO itself; noted in #8 | deferred to #8 |
| code-review | sharp's prebuilt libvips is LGPL-3.0-or-later; no THIRD_PARTY_NOTICES.md | minor | npm dependency, dynamically linked, not vendored; licence audit and notices file belong to #25 | deferred to #25 |
| code-review | EXIF orientation ignored, rotated JPEGs report swapped size | important | Use sharp `autoOrient` width/height; test with orientation 6 | fixed |
| code-review | Original sharp error dropped | minor | `new Error(msg, { cause })` | fixed |
| code-review | Image given for a video entry also yields duration/fps/audio violations | minor | Skip video checks when the kind does not match | fixed |
| code-review | ffprobe reports comma-separated container lists | important | Format is a list of candidates; any allowed candidate matches | fixed |
| code-review | Unverified `sourceUrl` points to the research file in a "private" repo | minor | Repo is public since 2026-11-18; link works | rejected |
| code-review | Three similar size helpers in apple/google/web | minor | Accepted; data files stay self-contained | accepted |
| code-review | `['all']` rejected; `LocaleSelection` type is effectively `string` | minor | "all" accepted inside lists; type documented as user input | fixed |
