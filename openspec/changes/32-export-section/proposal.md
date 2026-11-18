Issue: #32

# Proposal

## Why

The export checklist and the ZIP download exist as API since #5, but the Export section of the UI only shows an empty
state. Users need to see per store what is ready, what is missing or invalid, and download the store-ready ZIP for
the languages they choose.

## What Changes

- The Export section shows the checklist for the languages chosen in the section's locale bar: an overall status, one
  card per enabled store with every asset set (name, language, required marker, status badge, messages), errors first.
  The checklist reloads when the language selection changes.
- A download button builds the ZIP for the chosen languages and saves it under the name the server gives. While
  required assets are missing or invalid, a hint explains that the ZIP is incomplete, and the download asks for a
  confirmation first.
- When nothing has been generated yet, the existing empty state is shown above the checklist.
- Problems outside any asset (for example invalid manifest entries) are listed in an error message.

Acceptance criteria from the issue:
- Export section uses `GET /api/export/checklist` and `POST /api/export`.
- Checklist per target with status badges (ok / warning / error) and the messages.
- Shared locale selector decides which locales go into the ZIP.
- Download button; with missing required assets a hint, download still possible after a confirmation.
- E2E test: open Export, download the ZIP, assert the file list.

Targets: App Store, Google Play, web. Locales: all 6 (`de-DE`, `en-US`, `es-ES`, `it-IT`, `fr-FR`, `tr-TR`), one,
several or all.

## Not in this change

- Generating assets from the Export section; previews of the files (L4 comes with the asset sections).
- Changes to the export API or the ZIP layout.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell`: the Export section shows the checklist and offers the ZIP download.

## Impact

- `src/web/pages/ExportPage.tsx`, new components (see design), `src/web/api.ts`, `src/web/lib/export.ts`,
  `src/web/App.tsx`, `src/web/i18n/en.ts`; tests in `tests/unit/web-lib.test.ts` and `tests/e2e/`.
