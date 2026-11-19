Issue: #81

# Proposal

## Why

Found in the code review of #30. The generators (screenshot cards, framed screenshots, share images, creative assets)
resolve `"all"` with `resolveLocales`, which returns all six catalogue locales, not the project's locales. A German and
English project that calls a generate route with `{"locales":"all"}` writes Spanish, Italian, French and Turkish files
too, and an explicit locale outside the project is generated as well. Export already treats `"all"` as the project's
locales and rejects locales outside the project. AI jobs reject outside locales but expand `"all"` to six first, so
`"all"` on a two-locale project fails. The UI always sends explicit project locales, so API and skill callers are
affected.

## What Changes

- New helper `selectProjectLocales(projectLocales, selection)` in `src/core/locales/`: no selection or `"all"` means
  the project's locales; every entry is checked against the catalogue first, then against the project; the message
  names every locale outside the project.
- Export (`selectExportLocales`), the four generators and `createJob` use it and wrap its message in their own error
  class (`ExportError`, `GeneratorError`, `JobError`), so the routes keep their status codes.
- The job message changes from "is not a language of this project" to "is not a locale of this project", like export.

Acceptance criteria from the issue:
- One helper used by export and every generator: `"all"` means the project's locales, entries outside the project are
  rejected with a message.
- Unit tests for a generator called with `"all"` on a two-locale project.

Targets: all. Locales: all 6 (no change to the catalogue).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `media-locales`: a selection for a project resolves "all" to the project's locales and rejects outside locales.

## Impact

- `src/core/locales/index.ts`, `src/core/export/zip.ts`, `src/core/generators/{screenshot-cards,framed-screenshots,
  share-images,creative-assets}.ts`, `src/core/jobs/jobs.ts`.
- Tests: `tests/unit/locales.test.ts`, generator tests, `tests/unit/ai-jobs.test.ts` (message).
- No UI, API shape or file layout change.
