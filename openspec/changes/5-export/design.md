# Design

## Context

Workspace (`src/core/workspace/`, #3) has `output/`; the spec catalogue and `validateMedia` / `inspectImage` exist
(#2). No generator exists yet, so this change defines the contract they will use. No UI work (moved to #32).

## Goals / Non-Goals

**Goals:**
- One manifest and one path helper that all generators use, so export never guesses what a file is.
- Checklist is a pure function of project, manifest and measured files, so it is easy to test and to show in the UI.

**Non-Goals:**
- Video measuring (#20), re-generating missing files, uploading to stores.

## Decisions

1. **Manifest `output/manifest.json`** with entries `{ specId, locale?, device?, order, name, path, fallbackInput }`.
   `registerOutput()` writes the file bytes and the entry together (queued like project saves); re-registering the
   same path replaces the entry. *Alternative:* scan the folder and infer spec ids from paths. Rejected: ambiguous
   (same size used by several specs) and fragile.
2. **Path helper `outputPath()`**: localized → `<target>/<locale>/<segment>/NN-name.ext`, shared →
   `<target>/shared/<segment>/name.ext`. `segment` is the device for screenshots (`apple.screenshot.iphone-6.9` →
   `iphone-6.9`) and the spec id without target otherwise (`google.launcher-icon` → `launcher-icon`), so it is unique per
   spec. Names go through `safeBaseName`. `readManifest` accepts an entry only when its path equals `outputPath()` of
   its own fields; the export also refuses symbolic links and files whose real path is outside `output/`.
3. **Checklist items** keyed by `(specId, locale | shared)` with status `ok | warning | error` and messages.
   Scope per enabled target: required specs ∪ project devices ∪ specs with registered files. Video files get a
   "not measured yet" warning; images are measured with `inspectImage` and validated with `validateMedia`.
   The export function takes the measuring function as a parameter, so tests can inject measurements.
4. **ZIP with fflate's streaming `Zip` + `ZipPassThrough`** (stored, no compression: media is already compressed),
   written to `exports/<project>-<locales>-<timestamp>.zip` and streamed to the client with
   `Content-Disposition: attachment`. *Alternative:* `archiver`. Rejected: more dependencies; fflate is small and MIT.
5. **Locale selection** via `resolveLocales`, then intersected with the project's locales; anything outside is a 400.
6. **API:** `GET /api/export/checklist?locales=de-DE,tr-TR|all`, `POST /api/export` with JSON `{ locales }`. Both are
   behind `localOnly()`.

## Risks / Trade-offs

- [Manifest and files drift if users delete files by hand] → the checklist reports registered files that no longer
  exist as errors; re-generating fixes it.
- [Large exports] → streaming to disk and to the response; nothing is held in memory as a whole.
- [Apple's "6.9 or 6.5" rule is conditional] → only entries with `required: true` are enforced; conditional ones show
  their condition as an info message when they are part of the project.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | Shared paths built from group only; assets of one group overwrite each other | important | Folder segment unique per spec (device for screenshots, spec id otherwise) | fixed |
| code-review | ZIP included files of disabled targets | important | Filter entries by enabled target | fixed |
| code-review | ZIP writes ignored backpressure | important | Await `drain` while streaming | fixed |
| code-review | Failed export left a partial ZIP and an open stream | important | Destroy stream and delete the file on error | fixed |
| code-review | Same-second exports wrote the same file | important | Random suffix in the ZIP name | fixed |
| code-review | Re-registering a set position under a new name left the old file | important | Replace by (spec, locale, order) and delete the old file | fixed |
| code-review | Missing videos only warned | important | Missing files are errors for every kind | fixed |
| code-review | Manifest paths unvalidated (also security-review, confidence 8) | important | Entry path must equal `outputPath()` of its fields; invalid entries dropped and reported | fixed |
| code-review | Malformed request body exported all locales | minor | 400 for invalid JSON, wrong type and empty list; empty body = all | fixed |
| code-review | No THIRD_PARTY_NOTICES.md for new dependencies | minor | File added with runtime dependencies; full audit stays in #25 | fixed |
| security-review | Symbolic link under output/ could pull a private file into the ZIP | important | `locateOutputFile`: lstat + realpath inside output/; checklist reports links | fixed |
| security-review | Content-Disposition header injection, CSRF, DNS rebinding, cross-origin reads | — | Not exploitable (safe file name, `localOnly()`) | done |
