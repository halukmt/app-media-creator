# Tasks

## 1. Core

- [x] 1.1 `src/core/specs/texts.ts`: store text catalogue (fields, order, limits, units, sources) and `checkStoreText`
- [x] 1.2 `src/core/workspace/store-texts.ts`: `store-texts.json` read / revision-checked save
- [x] 1.3 Jobs: task `store-texts` (brief, command, result checks against the catalogue), `applyStoreTexts`,
      jobs listed per task
- [x] 1.4 Export: store text files in the ZIP (store locale codes, paste order) and checklist items

## 2. Server

- [x] 2.1 `GET/PUT /api/store-texts` (revision required, 409 with the current document)
- [x] 2.2 `POST /api/jobs` with `task`, `GET /api/jobs?task=`, apply of store text jobs

## 3. Skill

- [x] 3.1 `skills/amc-store-texts/`: SKILL.md, store text rules, light humanizer pass, `scripts/check.mjs`
- [x] 3.2 `THIRD_PARTY_NOTICES.md`: ste80-humanizer and blader/humanizer (MIT)

## 4. UI

- [x] 4.1 Reuse map (component-architect) and INVENTORY entries
- [x] 4.2 Store texts section: fields per language and store with counters and messages, autosave with revision
- [x] 4.3 AI job panel for store texts (prepare, command, live status, apply with confirmation)
- [x] 4.4 Screenshots section reads the newest copy job only

## 5. Tests and docs

- [x] 5.1 Unit: catalogue and checks (de-DE, tr-TR), document, jobs (brief, checks, apply), export paths, routes,
      skill check script vs. tool
- [x] 5.2 E2E: Store texts section (type, counter, autosave, axe at 375 / 768 / 1280 px)
- [x] 5.3 README section; CHANGELOG (Added)

## 6. Verification loop

- [x] 6.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 6.2 `/code-review`, `security-review`, `design-critic`; findings in the review log
