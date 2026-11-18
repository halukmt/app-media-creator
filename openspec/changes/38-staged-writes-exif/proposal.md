Issue: #38

# Proposal

## Why

The Codex review of PR #37 found two defects in shared code that the next logo generators (#6, #7) reuse: a failed
batch registration can leave a mix of old and new files, and JPEG logos with an EXIF orientation are rendered rotated.

## What Changes

- Batch registration writes every file to a temporary name first and replaces the previous files only after all of
  them were written; on a failed write the temporary files are removed and the previous set stays unchanged.
- Logos are auto-oriented (EXIF) before they are resized in every render path.

Acceptance criteria from the issue: staged writes with cleanup, auto-orientation in every render path, tests for both.

Targets: all. Locales: not language-specific.

## Not in this change

- Rollback of a rename that fails half-way (only after all files were written successfully; very unlikely).

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `export`: a batch registration is all or nothing.
- `web-icons`: logos keep their displayed orientation.

## Impact

- `src/core/export/manifest.ts`, `src/core/generators/render.ts`, `src/core/generators/web-icons.ts` and tests.
