## 1. Hooks

- [x] 1.1 `useAiJob(task)` in `src/web/hooks/useAiJob.ts`
- [x] 1.2 `useRevisionAutosave` in `src/web/hooks/useRevisionAutosave.ts` with `applyLocked`
- [x] 1.3 `isConflict` and `messagesOf` in `src/web/api.ts`

## 2. Pages

- [x] 2.1 StoreTextsPage uses both hooks
- [x] 2.2 ScreenshotsPage uses both hooks (uploads via `onLoaded`, previews via `onChangedElsewhere` / `onSaved`)
- [x] 2.3 LogoPage uses `messagesOf` from `api.ts`

## 3. Docs

- [x] 3.1 Rule for `src/web/hooks/` in `.claude/rules/components.md`; INVENTORY intro names hooks

## 4. Final check

- [x] 4.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.2 `/code-review`, `design-critic` not needed (no visible change); CHANGELOG line under Changed
