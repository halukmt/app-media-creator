Issue: #30

# Proposal

## Why

Two Codex findings on PR #29 (spec and locale catalogue), kept in the Backlog until now:
1. `apple.preview.ipad-legacy` accepted only 900×1200, but the iPad 12.9" (2nd gen) also takes 1200×1600 app previews.
2. `resolveLocales(["all", "pt-BR"])` returned all six locales instead of rejecting `pt-BR`.

## What Changes

- The entry is split into `apple.preview.ipad-12.9` (1200×1600 and 900×1200) and `apple.preview.ipad-9.7` (900×1200).
  No generator or UI referenced the old id; video previews come with M5.
- `resolveLocales` checks every entry before expanding "all".

Acceptance criteria from the issue:
- Both fixes with unit tests.
- Main spec `media-locales` scenario for "all" with an unsupported locale.

Targets: App Store (catalogue), all (locales). Locales: no change to the six.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `media-locales`: "all" with an unsupported locale is rejected.
- `media-specs`: iPad app preview entries per generation.

## Impact

- `src/core/specs/apple.ts`, `src/core/locales/index.ts`; tests in `tests/unit/locales.test.ts` and `tests/unit/specs-validate.test.ts`.
