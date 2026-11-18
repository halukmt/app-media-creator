# Tasks

## 1. Setup

- [x] 1.1 Add `zod` as a runtime dependency and verify `npm ls zod` shows it

## 2. Workspace core

- [x] 2.1 Implement `src/core/workspace/project.ts` (schema, defaults, locale resolution, device check, validation messages) and verify `tests/unit/workspace-project.test.ts` covers defaults, valid save, "all", invalid device and locale, source locale outside the selection
- [x] 2.2 Implement `src/core/workspace/workspace.ts` (open / create folders, read and atomic write of `project.json`, unchanged settings on invalid save) and verify `tests/unit/workspace.test.ts` covers first start and existing workspace
- [x] 2.3 Implement `src/core/workspace/inputs.ts` (type detection by content, size limits, safe names, per-locale folders, list) and verify `tests/unit/workspace-inputs.test.ts` covers valid upload, fake extension, too large, unsupported locale and path traversal

## 3. Server and CLI

- [x] 3.1 Add the API protection middleware and bind to 127.0.0.1; verify `tests/unit/server-protection.test.ts` rejects foreign `Origin` and `Host` and accepts the tool's own origin
- [x] 3.2 Add routes `GET/PUT /api/project`, `POST /api/inputs/:kind`, `GET /api/inputs` and verify `tests/unit/server-workspace.test.ts` covers read, save, rejected save, upload and list over HTTP
- [x] 3.3 Add `--workspace`/`-w` to the CLI, create the workspace on start and update the help text; verify the CLI argument tests and a manual start in a temporary folder

## 4. Verification loop

- [x] 4.1 `npm run build`, `npm run check`, `npm run check:all`, `npm test`, `npm run test:e2e` all pass
- [x] 4.2 `/code-review` and `security-review` on the change; findings recorded in the review log of `design.md` and critical ones fixed
