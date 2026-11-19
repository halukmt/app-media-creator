Issue: #24

# Proposal

## Why

The tool makes every store image, but not the texts of a store listing. Users still write name, subtitle,
description and keywords for six languages by hand, without a check against the store limits, and copy them into
App Store Connect and Play Console field by field.

## What Changes

- **Store text catalogue** (`src/core/specs/texts.ts`): one entry per field with store, paste order, limit and unit
  (Apple keywords are limited in bytes), required flag, `verified` and source URL. App Store: name, subtitle,
  promotional text, description, keywords, what's new. Google Play: title, short description, full description.
  `checkStoreText` reports limit errors and advisory warnings (keyword format and duplicates, words repeated from
  name or subtitle, emoji or ALL CAPS in the Play title).
- **Workspace document** `store-texts.json`: texts per locale and field, revision-checked saves like the screenshot
  sets.
- **AI job task `store-texts`**: the brief lists the fields of the enabled stores with their limits, the current
  texts and the screenshots with their headlines; the command is `/amc-store-texts "<job folder>"`. Results
  (`store-texts/<locale>/<field>.md`) are checked against the catalogue; applying merges the written fields into the
  document after a confirmation and keeps all other texts. Jobs can be listed per task.
- **Skill `skills/amc-store-texts/`**: workflow, store text rules (ASO keywords per locale, not translated 1:1), a
  light humanizer pass on long texts adapted from ste80-humanizer (MIT, with notice), and a dependency-free check
  script.
- **Store texts section** in the UI: fields per selected language and enabled store with live character (or byte)
  counters and messages, autosave, and the AI job panel.
- **Export**: the ZIP holds `apple/store-texts/<App Store Connect code>/NN-<field>.txt` and
  `google/store-texts/<Play code>/NN-<field>.txt` in paste order; the checklist checks the store texts per locale.

Acceptance criteria from the issue:
- App Store: name, subtitle, promotional text, description, keywords, what's new; Play: title, short and full
  description.
- Character limits checked per field; keywords as ASO list per locale, not translated 1:1.
- Humanizer pass (ste80-humanizer, light mode) on long texts; licence notice.
- ZIP `store-texts/<locale>/NN-field.txt` in paste order with App Store Connect and Play locale codes.

Targets: App Store, Google Play. Locales: all 6 (one, several or all).

## Capabilities

### New Capabilities
- `store-texts`: catalogue, document, checks, UI section and export of store texts.

### Modified Capabilities
- `ai-jobs`: job task `store-texts`, its skill, apply, and listing jobs per task.

## Impact

- New: `src/core/specs/texts.ts`, `src/core/workspace/store-texts.ts`, `src/server/store-texts-routes.ts`,
  `src/web/pages/StoreTextsPage.tsx` (+ components per the reuse map), `skills/amc-store-texts/`, tests.
- Changed: `src/core/jobs/*` (task, brief, checks, apply), `src/core/export/*` (ZIP and checklist),
  `src/server/jobs-routes.ts`, `src/web/api.ts`, `src/web/App.tsx`, the Screenshots page (newest copy job),
  `THIRD_PARTY_NOTICES.md`, `README.md`.
