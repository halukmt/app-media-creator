Issue: #98

# Proposal

## Why

Codex finding on PR #95, also true for Logo and Screenshots. When a user edits a field and leaves the section at once
(the `Export →` link or the sidebar), the page unmounts and its cleanup starts the save without anyone awaiting it.
The Export page reads its checklist before that save lands and shows stale validation or keeps the download disabled;
a section opened again can show the older version for the same reason. If that last save fails, the edit is lost
silently because the editor is gone.

## What Changes

- New pure tracker `src/web/lib/pending-saves.ts`: `track(section, save)`, `settled()`, `subscribe(listener)`.
- Saves started on leaving are tracked: `useRevisionAutosave` (Screenshots sets, Store texts; needs a `section`), the
  Screenshots creative settings and the Logo settings. A save dropped by a conflict counts as lost too.
- The Export checklist and the first load of Logo, Screenshots (sets and creative settings) and Store texts wait for
  `settled()`.
- The app shell lists sections whose last edit was lost after leaving (error for a failed save, warning for one dropped
  by a conflict), with a link back and a Dismiss button; the message stays until dismissed.

Acceptance criteria from the issue:
- Saves started while leaving a section are tracked in one place; the Export page waits for them before it loads the
  checklist.
- A save that fails after leaving a section is reported in the shell (`alert` with the section name and a link back).
- E2E: edit a store text, click `Export →` at once, the checklist is read after the save (fails on the old code).
- Unit tests for the tracker (success and failure).

Targets: all. Locales: no change.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: edits made just before leaving a section are saved before other pages read them, and a lost one is reported.

## Impact

- `src/web/lib/pending-saves.ts` (new), `src/web/hooks/useRevisionAutosave.ts`, `src/web/App.tsx`, `src/web/i18n/en.ts`,
  `src/web/pages/{ExportPage,LogoPage,ScreenshotsPage,StoreTextsPage}.tsx`.
- Tests: `tests/unit/web-pending-saves.test.ts`, `tests/e2e/store-texts.spec.ts`.
