Issue: #101

# Proposal

## Why

Found in the code review of #98. The Logo settings and the header / search image settings carried their own debounced
autosave (queue, timer, flush, the tracked save on leaving, `settled()` before the first load, `reportSaved`), and
`useRevisionAutosave` had the same core again. A page with autosave could forget to wait or to track, and #98's bug
would come back.

## What Changes

- `src/web/hooks/useAutosave.ts`: debounced autosave of one document: `schedule`, `flush`, `discard`, `saveState`;
  leaving the page sends a pending edit and tracks it (`pendingSaves.track`); a stored save reports the document as
  saved; optional `discardOn` / `onDropped` for revision conflicts.
- `src/web/hooks/useLoadAfterSaves.ts`: runs the first load after `pendingSaves.settled()`, skipped when the page is
  gone.
- `useRevisionAutosave` builds on both (revision handling, numbered reloads and the edit lock stay there).
- Logo settings and the creative settings in Screenshots use `useAutosave` and `useLoadAfterSaves`.

Acceptance criteria from the issue:
- One hook for debounced autosave with flush, unmount tracking, `settled()` before the first load and `reportSaved`.
- Logo settings and creative settings use it; `useRevisionAutosave` shares the core.
- Existing unit and e2e tests stay green.

No visible change. Locales: not applicable.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; behaviour unchanged, so no delta spec: `skip_specs`)

## Impact

- New: `src/web/hooks/{useAutosave,useLoadAfterSaves}.ts`.
- Changed: `src/web/hooks/useRevisionAutosave.ts`, `src/web/pages/{LogoPage,ScreenshotsPage}.tsx`.
