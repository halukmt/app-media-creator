# Tasks

## 1. Core and server

- [x] 1.1 `revision` in the sets; serialized save with the revision check and conflict result
- [x] 1.2 `PUT /api/screenshots`: 400 without a revision, 409 with the current sets on a conflict

## 2. UI

- [x] 2.1 Save queue `discard()`; the page stamps saves with the known revision, reloads and warns on 409

## 3. Tests

- [x] 3.1 Unit: revision counting, two concurrent saves, unconditional internal save, API 400/409, AI apply bumps the revision, queue discard, unseen upload still appended
- [x] 3.2 E2E: two tabs editing the same set
- [x] 3.3 CHANGELOG (Fixed)

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review`, `security-review`; findings in the review log
