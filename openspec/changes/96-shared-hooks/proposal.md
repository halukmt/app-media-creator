Issue: #96

# Proposal

## Why

The Screenshots and Store texts pages each carry their own copy of two pieces of state logic: following the newest
AI job of a task, and the revision-checked autosave with the edit lock around an AI apply (#84, #85, #87, #89, #92).
Three lock fixes in a row had to be made in one page and then copied. Found in the component-architect review of #24.

## What Changes

- `src/web/hooks/useAiJob.ts`: newest job of a task (`fetchJobs`), the event stream follow, `refreshJob` with a version
  counter, `showJob` for a new job or the optimistic "applied" state.
- `src/web/hooks/useRevisionAutosave.ts`: save queue with `discardOn` conflicts, debounce, `flush`, numbered reloads,
  stale-answer and changed-elsewhere handling, the unmount flush, the edit lock and `applyLocked(apply)`.
  Page-specific effects come as callbacks (`onLoaded`, `onServerDocument`, `onChangedElsewhere`, `onSaved`).
- `isConflict` and `messagesOf` move to `src/web/api.ts` next to `ApiError`.
- Both pages use the hooks; their markup and components are unchanged.
- Rule for `src/web/hooks/` in `.claude/rules/components.md`; INVENTORY notes that hooks are not listed.

Acceptance criteria from the issue:
- One hook for following the newest job of a task (fetch, event stream, refresh, optimistic applied state).
- One hook for revision-checked autosave with conflict handling and the apply edit lock.
- Screenshots and Store texts use them; the existing unit and e2e tests (#84/#87/#92 scenarios) stay green.

No visible change, no API change. Locales: not applicable.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; behaviour is unchanged, so no delta spec: `skip_specs`)

## Impact

- `src/web/hooks/` (new), `src/web/pages/ScreenshotsPage.tsx`, `src/web/pages/StoreTextsPage.tsx`, `src/web/api.ts`.
- Out of scope: the creative settings autosave (no revision) and LogoPage's autosave; leaving a section with pending
  saves is #98 and builds on the new hook.
