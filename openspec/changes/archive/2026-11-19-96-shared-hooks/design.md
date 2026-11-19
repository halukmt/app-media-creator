# Design

## Reuse map (component-architect)

- No component changes: `AiJobPanel`, `AiResultCard`, `SaveStatus`, `StatusAlert`, `StoreTextsCard`, `SlotEditor` stay.
- Reused as is: `createSaveQueue`, `SaveDiscardedError` and `discardOn` (`lib/save-queue.ts`); `fetchJobs`, `fetchJob`,
  `JOB_EVENTS_URL` (`api.ts`); `headlineLocales` / `storeTextLocales` (`lib/ai-jobs.ts`) stay in the pages.
- `SaveState` comes from `SaveStatus.tsx`; ScreenshotsPage drops its own copy of the union.
- Hooks are state logic, not components: no INVENTORY row; `check:inventory` scans only `components/`.

## Decisions

1. **Generic load answer.** Screenshots loads uploads and sets together and must set the uploads even when the sets in
   the same answer are stale. The hook takes `load(): Promise<L>` plus `documentOf(L)` and calls `onLoaded(L)` for
   every current answer, before the revision check.
2. **Callbacks through a ref.** The save queue is created once; it reads the page's current callbacks from a ref.
3. **`applyLocked(apply)` keeps the old order.** Flush first (on failure: no apply, lock kept only for an earlier apply
   that waits for its reload, which is retried); then the apply; `lockedAfter` is set in `finally`; then one reload. The
   page's apply callback handles its own errors and refreshes the job; an error that escapes still reaches the reload
   and is rethrown after it.
4. **No hook unit tests.** There is no DOM test setup; the e2e scenarios of #84, #85, #87, #89 and #92 cover the hooks.
   The pure parts stay in `lib/` with their tests.

## Follow-up (not in this change)

- The "load failed + retry" markup differs between the two pages; candidate for one shared component (visible change).
