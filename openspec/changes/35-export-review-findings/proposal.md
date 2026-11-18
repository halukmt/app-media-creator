Issue: #35

# Proposal

## Why

The Codex review of PR #33 found two defects in the export from #5. Output names with dots (such as a `home.dark`
variant) do not survive the manifest check and vanish from the export, and a failing ZIP write can crash the server
instead of returning an error. The logo generators (#6–#8) register variant names next, so both must be fixed first.

## What Changes

- Output names are cleaned once with the same rule everywhere (no extension stripping), so a registered entry always
  matches its own path when the manifest is read again.
- ZIP write errors are handled as soon as they happen: the export ends with an error and leaves no partial file.

Acceptance criteria from the issue:
- Names round-trip through the manifest; test with `home.dark`.
- Output stream errors end the export with an error; test with an unwritable exports folder.

Targets: all. Locales: not language-specific.

## Not in this change

- Other export behaviour.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `export`: registered names with dots stay in the export; a failed ZIP write is reported as an error.

## Impact

- `src/core/export/manifest.ts`, `src/core/export/zip.ts` and their tests.
