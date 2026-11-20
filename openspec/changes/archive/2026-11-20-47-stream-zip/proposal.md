Issue: #47

# Proposal

## Why

The Export section downloaded the ZIP with `fetch` and held it in memory as a Blob before saving it. With app previews,
device videos and loops for six languages (M5), an export can reach hundreds of megabytes. Also (#48): when the
browser aborted the request, the server still finished building the ZIP.

## What Changes

- `POST /api/export/prepare` builds the ZIP and answers with `{ token, fileName, status }`; `GET /api/export/download?token=…`
  streams that ZIP as an attachment (`content-length`, `no-store`). Tokens are random (24 bytes) and valid for 10
  minutes (download managers retry); after that a ZIP that was never fetched is removed. The API stays behind
  `localOnly`, and only the prepare step (a POST with the origin checks) issues tokens.
- The page says the download has started (it cannot see the browser finish it).
- The UI prepares, then opens the download URL through a temporary link, so the browser streams the ZIP straight to
  disk. The confirmation flow, the file name from the server and the status message stay as they are.
- `createExport` takes an `AbortSignal`: an aborted request stops the build and removes the partial ZIP. Both
  `POST /api/export` (kept for API and skill clients) and the prepare step pass the request's signal.
- `downloadFileName` (header parsing) becomes `safeFileName` (base name of the name the server sent).

Acceptance criteria from the issue:
- The browser streams the ZIP straight to disk (GET export URL with a one-time token), keeping the local API protection.
- The confirmation flow and the file name from the server stay as they are.
- The UI still learns the export status.
- The e2e test for the download stays green; the build stops on client abort (follow-up from #48).

Targets: all. Locales: all 6 (no change).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `export`: the UI download is prepared and then streamed with a one-time token; an aborted export stops.

## Impact

- `src/core/export/zip.ts`, `src/server/export-routes.ts`, `src/web/{api.ts,lib/export.ts,pages/ExportPage.tsx}`;
  tests `tests/unit/{server-export,web-lib}.test.ts`, `tests/e2e/export.spec.ts`.
