# Tasks

## 1. Data and helpers

- [x] 1.1 API client `fetchChecklist` (abortable) and `downloadExport`; verify `npm run check`
- [x] 1.2 Helpers `summarizeChecklist`, `sortByStatus`, `groupBySpec`, `isWorseStatus`, `downloadFileName`, `projectLocaleOptions`; verify `tests/unit/web-lib.test.ts`

## 2. UI

- [x] 2.1 Reuse map in `design.md`; new components in `INVENTORY.md` before their files; verify `npm run check:inventory`
- [x] 2.2 `SectionLayout`, `SectionEmptyState`, `StatusBadge`, `RequiredBadge`, `BusyButton`, `ConfirmDialog`, `ChecklistCard`; ProjectPage and SectionPage use them; verify e2e of Project and shell
- [x] 2.3 `ExportPage`: status, download with confirmation, grouped checklist; verify e2e checklist, cancel, Escape and download tests

## 3. Verification loop

- [x] 3.1 e2e: axe and screenshots at 375 / 768 / 1280 px with data, no horizontal scroll
- [x] 3.2 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 3.3 `/code-review` and `design-critic`; security-review not needed (no server or file-handling change); findings in the review log
