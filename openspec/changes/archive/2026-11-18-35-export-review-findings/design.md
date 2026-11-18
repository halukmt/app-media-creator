# Design

## Context

`outputPath()` cleaned names with `safeBaseName()`, which strips a trailing `.xxx` as an extension. Called once at
registration and again in `checkEntry()`, a dotted name lost one segment per call. In `createExport()`,
`once(out, 'finish')` was only awaited after the file loop, so a stream error during the loop had no handler.

## Decisions

1. **`cleanOutputName()`**: the character rules of `safeBaseName()` (lower case, `[a-z0-9._-]`, no leading or trailing
   dots and dashes, 80 characters) without removing anything as an extension. It is idempotent, so the stored name
   reproduces the stored path. Generators pass names without extension (the extension is a separate option).
2. **Stream errors:** record the first `error` of the write stream in a variable as soon as it is emitted, check it
   after every awaited step, and attach a no-op catch to the `finish` promise so it never becomes an unhandled
   rejection; the final `await` still throws and reaches the existing cleanup.

## Risks / Trade-offs

- [Existing manifests with dotted names were already dropped] → nothing to migrate: affected entries were never kept.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| Codex (PR #33) | Dotted names dropped on manifest read | important | Idempotent `cleanOutputName()` | fixed |
| Codex (PR #33) | Unhandled rejection on ZIP write error | important | Record stream errors at once, check after each await | fixed |
| code-review | No findings | — | — | done |
