Issue: #106

# Proposal

## Why

Codex finding on PR #105. `ffprobeBinary` derived the ffprobe path from `FFMPEG_PATH` by replacing a leading
`ffmpeg` in the file name. For a binary with another name (a wrapper such as `custom-encoder`) nothing was replaced,
the "sibling" was ffmpeg itself, and it was returned as ffprobe; every preview then failed.

## What Changes

- The sibling is used only when the file name starts with `ffmpeg`; otherwise `ffprobe` from the PATH.
- Unit test for a wrapper name.

Acceptance criteria from the issue:
- A sibling ffprobe is used only when the ffmpeg file name starts with `ffmpeg`; otherwise `ffprobe` from the PATH.
- Unit test for a wrapper name that does not start with `ffmpeg`.

Targets: App Store (video). Locales: not applicable.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; the documented behaviour of `store-preview-videos` is unchanged, so no delta spec: `skip_specs`)

## Impact

- `src/core/video/tools.ts`, `tests/unit/store-previews.test.ts`.
