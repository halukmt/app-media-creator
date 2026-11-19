Issue: #103

# Proposal

## Why

Codex finding on PR #102. Screenshots saves two documents with their own queues (the screenshot sets and the header
image settings), and both reported to `pendingSaves` as `screenshots`. When the user left with both pending and one
save failed while the other worked, the success cleared the lost-edit message although it stored a different
document; the user reached Export without a sign that their screenshot changes were lost.

## What Changes

- `pendingSaves` names a `SaveSource` (`section` + `document`) for `track`, `reportSaved` and the subscribers.
- Pure helpers `withOutcome(lost, source, outcome)` and `lostSections(lost)` in `src/web/lib/pending-saves.ts`: losses
  are kept per document, a save clears only its own document, the shell shows one message per section (failure wins).
- Documents: the revisioned document of a section (`screenshots`, `store-texts`), `creative-settings`, `logo-settings`.

Acceptance criteria from the issue:
- Outcomes are tracked per document, so a save of one document never clears the loss of another.
- The shell still shows one message per section (failure wins over a conflict).
- Unit test: a failed save of one document stays reported after a sibling document of the same section saved.

Targets: all. Locales: not applicable. No visible change apart from the fixed case.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `app-shell`: lost edits are kept per document.

## Impact

- `src/web/lib/pending-saves.ts`, `src/web/App.tsx`, `src/web/hooks/useRevisionAutosave.ts`,
  `src/web/pages/{LogoPage,ScreenshotsPage}.tsx`; `tests/unit/web-pending-saves.test.ts`.
