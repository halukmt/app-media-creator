## 1. Server

- [x] 1.1 `createExport` honours an `AbortSignal` (partial ZIP removed); both export routes pass the request signal
- [x] 1.2 `POST /api/export/prepare` and `GET /api/export/download` with one-time, expiring tokens

## 2. UI

- [x] 2.1 Prepare, then a plain link download; `safeFileName` replaces the header parsing

## 3. Tests

- [x] 3.1 Unit: prepare and download, used / unknown / expired tokens, aborted build leaves nothing
- [x] 3.2 E2E: download and the #48 abort scenario on the prepare step

## 4. Final check

- [x] 4.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`
- [x] 4.2 `/code-review`, `security-review`; CHANGELOG under Changed
