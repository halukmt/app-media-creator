# Design

## Context

`registerOutputs` (#8) writes each file over its target, then the manifest. `renderLogoSquare` and the PNG path of
`icon.svg` call sharp without orientation handling, and `loadLogo` reports the stored, not the displayed, size.

## Decisions

1. **Staging:** write all files to `<target>.<random>.tmp`; if any write fails, delete the temporary files and throw.
   Then rename each temporary file onto its target, remove replaced set positions, and write the manifest last.
2. **Orientation:** `sharp(...).autoOrient()` before `resize` in both render paths; `loadLogo` reports
   `autoOrient` width and height.

## Risks / Trade-offs

- [A rename fails after others succeeded] → extremely unlikely after successful writes in the same folder; not rolled back.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| Codex (PR #37) | Failed batch write leaves mixed old and new files | important | Stage to temporary files; check targets are files before replacing | fixed |
| Codex (PR #37) | EXIF orientation ignored when rendering logos | important | `autoOrient()` in every render path; displayed size in `loadLogo` | fixed |
| code-review | Leftover temporary files when a rename fails half-way | minor | Remove the remaining temporary files on rename failure | fixed |
