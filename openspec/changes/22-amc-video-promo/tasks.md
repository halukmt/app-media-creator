## 1. Core

- [x] 1.1 Specs `web.promo.*` and `google.promo-video`, asset group `promo`
- [x] 1.2 `src/core/jobs/promo.ts`: options check, brief, ffprobe checks, outputs; task `promo-video` in `jobs.ts`
- [x] 1.3 Video settings: purpose `promo`, formats, website and repository

## 2. Server and skill

- [x] 2.1 `POST /api/jobs` accepts `promo` options
- [x] 2.2 `skills/amc-video` (SKILL.md, promo rules, check script); THIRD_PARTY_NOTICES

## 3. UI

- [x] 3.1 component-architect reuse map; purpose without recording, formats, URL fields, AI job panel, YouTube note
- [x] 3.2 `usePromoJob` hook, `toggleFormat`, `isWebUrlOrEmpty`, `promoLocales`

## 4. Tests and docs

- [x] 4.1 Unit tests (job, checks, apply, skill check script, settings, web helpers) and e2e promo flow
- [x] 4.2 README (promo docs, store texts install step fixed), CHANGELOG
- [x] 4.3 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`; `/code-review`, `security-review`, `design-critic`
