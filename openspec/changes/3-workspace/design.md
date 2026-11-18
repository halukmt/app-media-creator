# Design

## Context

The server (`src/server/app.ts`) only answers `/api/health` and serves the built UI. The CLI (`src/cli/`) parses
`--port`, `--no-open`. The spec and locale catalogues from #2 exist in `src/core/specs/` and `src/core/locales/`.
No UI work in this change, so no component reuse map.

## Goals / Non-Goals

**Goals:**
- All file system logic in `src/core/workspace/` (testable without HTTP); routes are thin.
- The workspace format is stable enough for later issues: `project.json` has a `version` field.

**Non-Goals:**
- Concurrency between several running instances on one workspace.
- Authentication; the tool is single-user on localhost.

## Decisions

1. **Layout:** `<workspace>/project.json`, `inputs/logo/`, `inputs/screenshots/<locale>/`, `inputs/videos/<locale>/`,
   `jobs/`, `output/`. Locale folders use the media locale ids.
2. **Settings schema with zod** (`project.ts`): `{ version: 1, name, targets: { apple, google, web }, sourceLocale,
   locales, claims: { allowed, forbidden } }`. Each target is `{ enabled, devices: string[] }`; devices are screenshot
   spec ids of that target (web has no devices). `locales` accepts "all", one id or a list on input and is stored
   resolved through `resolveLocales`. Defaults: App Store `iphone-6.9` + `iphone-6.3` (6.3 is required, 6.9 covers 6.5),
   Google Play `phone`, web enabled, source `en-US`, all locales.
   *Alternative:* hand-written validation. Rejected: more code, worse error messages.
3. **Atomic writes:** write `project.json.tmp` then rename, so a crash never leaves half a file.
4. **Upload checks by content:** images via sharp metadata (format list per kind), videos via the ISO base media
   `ftyp` box at bytes 4–8 with brand check (`qt  ` → mov, `M4V ` → m4v, otherwise mp4). Size limits are checked before
   reading the whole body (Hono `bodyLimit`) and again on the buffer.
5. **Safe file names:** take the base name only, replace everything outside `[a-z0-9._-]` with `-`, force the extension
   from the detected type, prefix a timestamp counter to avoid collisions; resolve the final path and assert it stays
   inside the workspace inputs folder.
6. **API protection middleware** for non-GET/HEAD requests: reject when `Host` is not `localhost`/`127.0.0.1` (with
   port) to block DNS rebinding, and when `Origin` is present and not `http://localhost:<port>` / `http://127.0.0.1:<port>`
   (the Vite dev server origin `http://localhost:5173` is allowed in dev). Form posts from other sites carry their
   own `Origin`, so they are rejected without needing CSRF tokens. Server binds to `127.0.0.1`.
7. **CLI:** `--workspace`/`-w <dir>`, resolved against the current directory.

## Risks / Trade-offs

- [Videos up to 500 MB are buffered in memory] → acceptable for a local tool now; streaming to disk can come with the video issues (#20).
- [Browsers that omit `Origin` on same-origin GET] → only changing methods are checked; GET is read-only.
- [zod adds a dependency] → MIT, small, widely used; also useful for job files (#15).

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | Any `ftyp` file (HEIC, AVIF, M4A) passed as MP4 | important | Brand allow-list, compatible-brand check, image/audio brands excluded | fixed |
| code-review | MOV files starting with `moov`/`wide`/`mdat` rejected | important | Accept QuickTime leading atoms as MOV | fixed |
| code-review | Same-name uploads in one millisecond → EEXIST → 500 | important | Random suffix in file names | fixed |
| code-review | PID-only temp file, overlapping saves race on rename | important | Random temp name and a save queue | fixed |
| code-review | Invalid `project.json` → opaque 500 | important | `ProjectFileError` with problems in the response | fixed |
| code-review | Body limit is the 500 MB video limit for every kind | important | Per-kind body limit before buffering; streaming to disk stays for #20 | fixed |
| code-review | OS junk files listed as inputs; stat race → 500 | minor | Skip hidden files and non-input formats; ignore vanished files | fixed |
| code-review | Default name from a long folder fails validation | minor | Trim to 100 characters, fallback "My app" | fixed |
| code-review | Default workspace constant duplicated | minor | CLI imports the core constant | fixed |
| code-review | Help text misaligned | minor | Aligned columns | fixed |
| security-review | No high-confidence findings; checked CSRF, DNS rebinding, path traversal, file content, JSON | — | — | done |
| security-review | Uploaded SVG logos become stored-XSS once inputs are served to the UI | hardening | Serve with `CSP: sandbox; default-src 'none'` and `nosniff`, or rasterize; noted in #10 and #14 | deferred |
