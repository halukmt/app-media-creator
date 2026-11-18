Issue: #3

# Proposal

## Why

Every later feature (logo pack, screenshots, AI jobs, export) needs a place to keep the user's settings, uploaded
inputs and generated output, and the UI needs an API to read and change it. The tool is meant to run inside other
repos, so this place is a folder in the user's project, not a database.

## What Changes

- A workspace folder (default `.app-media/` in the current directory, or a folder given on the command line) with
  `project.json`, `inputs/`, `jobs/` and `output/`, created on first start.
- `project.json` holds app name, targets (App Store, Google Play, web) with their device models, source locale,
  selected locales (one, several or all; default all 6) and claims (allowed and forbidden statements for AI copy).
- API to read and save the project settings, with validation of every field.
- API to upload inputs: logo, screenshots per locale and videos per locale, with checks of the real file type
  (not just the extension), size limits and safe file names; plus a list of all stored inputs.
- Protection of the local server: it listens only on the local machine, and changing requests from other websites
  or foreign host names are rejected.
- CLI option `--workspace <dir>`.

Acceptance criteria from the issue:
- `project.json` with app name, targets, devices per target, source locale, selected locales (default all 6), claims.
- Upload API stores inputs under `inputs/` (logo, screenshots and videos per locale), with type and size checks.
- Locale selection supports one, several or all locales.
- CLI option to choose the workspace directory; default `.app-media/` in the current directory.
- Unit tests for settings read / write, upload validation and path traversal protection.

Targets: not target-specific. Locales: all 6.

## Not in this change

- UI for the project settings and uploads (#4 and the section issues).
- Deleting or reordering inputs, serving input previews to the UI (with the screenshots section, #12 / #14).
- AI job files (#15) and export (#5); only their folders are created.

## Capabilities

### New Capabilities
- `workspace`: project folder, project settings, input uploads and the protection of the local server API.

### Modified Capabilities
- none

## Impact

- New `src/core/workspace/`, new server routes under `/api/project` and `/api/inputs`, CLI flag `--workspace`.
- Server binds to `127.0.0.1` instead of all interfaces.
- New dependency `zod` (MIT) for settings validation.
