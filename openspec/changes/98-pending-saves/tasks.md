## 1. Tracker

- [x] 1.1 `src/web/lib/pending-saves.ts` with unit tests (settles after all, reports failures, unsubscribe)

## 2. Saves on leaving

- [x] 2.1 `useRevisionAutosave` tracks its unmount flush (`section` option; conflict → `DroppedSaveError`) and loads after `settled()`
- [x] 2.2 Screenshots creative settings and Logo settings track their unmount flush and load after `settled()`
- [x] 2.3 Export loads its checklist after `settled()`

## 3. Shell

- [x] 3.1 `App.tsx` lists lost edits with a link back (`StatusAlert`, mounted live region); texts in `en.ts`

## 4. Tests and checks

- [x] 4.1 E2E: checklist after the save (fails on the old code), failed save reported and cleared
- [x] 4.2 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.3 `/code-review`, `design-critic`; CHANGELOG line under Fixed
