Issue: #68

# Proposal

## Why

Codex found this on #67: an environment label with characters the icon font cannot draw, such as `ТЕСТ` or `测试`,
was accepted. `cardFont()` only has Inter's Latin and Latin Extended subsets and skips characters without a glyph, so
the label silently disappeared from the generated icons while generation and the checklist reported success.

## What Changes

- Project validation rejects a label with characters that have no glyph in the icon font. The error is reported at
  `environments.<n>.badge` and names those characters. The Project screen shows it at the label field.
- Latin labels with Turkish and German letters stay valid.

Acceptance criteria from the issue:
- `PUT /api/project` rejects such a label with a field error that names the characters.
- The Project screen shows the error at the label field.
- Unit test: Cyrillic and CJK labels are rejected; `İ Ş Ü` are accepted.

Targets: App Store, Google Play, Web (icon variants). Locales: not language-specific.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `icon-variants`: labels must be drawable.

## Impact

- `src/core/workspace/project.ts`; tests in `tests/unit/icon-environments.test.ts` and `tests/e2e/project.spec.ts`.
