Issue: #5

# Proposal

## Why

Every generator (logo packs, screenshots, creative assets, video) produces files for the stores. Users need one place
that tells them whether everything a store requires is there and valid, and one download with all files in a
store-ready folder layout. Building this before the generators gives them a common contract for where files go.

## What Changes

- An output manifest in the workspace: generators register each generated file with its spec entry, locale,
  device and whether it was made from a fallback input. A path helper gives every generator the same folder layout:
  `<target>/<locale>/<device-or-group>/NN-name.ext`, text-free assets once under `<target>/shared/<group>/`.
- An export checklist per enabled target and selected locales: required assets present, counts within limits, each
  file valid against its spec; warnings for fallback inputs, unverified specs and files that cannot be measured yet.
- A ZIP export for one locale, several or all: only files of the selected locales plus the shared files, in the
  folder layout above, with a `CHECKLIST.md` at the root.
- API: `GET /api/export/checklist?locales=…` and `POST /api/export` (download of the ZIP).

Acceptance criteria from the issue:
- Folder layout `<target>/<locale>/<device>/NN-name.ext`; text-free assets once under `<target>/shared/`.
- Export for one locale, several or all.
- Checklist per target: required assets present, counts within limits, each file valid; warnings for fallback inputs
  and unverified specs.
- E2E test (via the API) unzips the archive and asserts the file list.

The criterion "Export section in the UI" moved to #32, because the app shell (#4) does not exist yet.

Targets: Apple App Store, Google Play, web / social. Locales: all 6.

## Not in this change

- Export UI (#32).
- Measuring videos (duration, fps, audio) — videos are listed with a "not measured yet" warning until #20.
- Uploading to App Store Connect or Google Play.

## Capabilities

### New Capabilities
- `export`: output manifest and folder layout, export checklist and ZIP download.

### Modified Capabilities
- none

## Impact

- New `src/core/export/`, new routes under `/api/export`, new workspace folder `exports/`.
- New dependency `fflate` (MIT) for streaming ZIP files.
