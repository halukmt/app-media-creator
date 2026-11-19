# Tasks

## 1. Core

- [x] 1.1 Result schemas (headlines, storyboard, store text fields) and their JSON Schema files
- [x] 1.2 `createJob`: brief, claims, images, video frames via ffmpeg (no shell), schemas
- [x] 1.3 `readJob` / `listJobs`: validation, forbidden claims, warnings, all-or-nothing
- [x] 1.4 `applyHeadlines`: variant into the screenshot sets, fallback languages get their own set

## 2. Server

- [x] 2.1 Job routes and the debounced folder watcher with server-sent events

## 3. UI

- [x] 3.1 component-architect reuse map; INVENTORY rows for `AiJobPanel`, `CommandBox`, `HeadlineVariantsCard`
- [x] 3.2 Panel in the Screenshots preview step: prepare, command, live status, comparison, apply with confirmation

## 4. Tests and docs

- [x] 4.1 Unit: job folder, fake and real ffmpeg, validation cases, apply, watcher, API, UI helpers
- [x] 4.2 E2E: prepare, write a result as the skill would, live update, apply variant B, axe
- [x] 4.3 CHANGELOG (Added)

## 5. Verification loop

- [x] 5.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 5.2 `/code-review`, `security-review`, `design-critic`; findings in the review log
