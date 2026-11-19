# Design

## Decisions

1. **Two entries instead of one with both sizes:** the 9.7" iPad must not accept 1200×1600, so one shared entry cannot
   express it. The old id `apple.preview.ipad-legacy` had no users (manifests hold only generated files, and no app
   preview generator exists yet).
2. **Validate before expanding:** the unsupported check ignores the literal "all" and runs first; then "all" expands.
   Export (`selectExportLocales`) had its own early "all" return; it now validates through `resolveLocales` first.

## Review log

- **/code-review:** 7 findings. Fixed: the export path returned early on "all" and still ignored `pt-BR` → validates
  through `resolveLocales` first, with a test (this also makes the CHANGELOG line true). Filed: generators expand
  "all" to all catalogue locales instead of the project's (existing behaviour, API and skill callers only) → #81
  (Backlog, P2/S). Accepted: the removed id `apple.preview.ipad-legacy` has no users (no app preview generator yet,
  manifests hold only generated files); the iPad test checks `matchesDimensions` with the catalogue sizes, because
  `validateMedia` for video needs duration and fps that this test is not about.
