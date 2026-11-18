# Tasks

## 1. Data for the UI

- [x] 1.1 Add `GET /api/catalogue` (locales, device models per target); verify `tests/unit/server-catalogue.test.ts`
- [x] 1.2 Add pure helpers for section routing, locale selection and claim lines in `src/web/lib/`; verify `tests/unit/web-lib.test.ts`
- [x] 1.3 Add the API client `src/web/api.ts` and UI strings `src/web/i18n/en.ts`; verify `npm run check`

## 2. Components and shell

- [ ] 2.1 Add the reuse map to `design.md` and the new components to `INVENTORY.md` before their files exist; verify `npm run check:inventory`
- [ ] 2.2 Build the components and the `AppShell` layout (drawer, navbar, sidebar menu with `aria-current`); verify e2e navigation test
- [ ] 2.3 Build the Project page (load, edit, save, server errors); verify e2e save and invalid-name tests
- [ ] 2.4 Build the generic section page with locale bar and empty state; verify e2e empty-state and project-locale tests

## 3. Verification loop

- [ ] 3.1 e2e: axe on every section, screenshots at 375 / 768 / 1280 px into `test-results/screenshots/`, no horizontal scroll at 375 px
- [ ] 3.2 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [ ] 3.3 `/code-review`, `design-critic` and `security-review` (new route) on the change; findings in the review log of `design.md`
