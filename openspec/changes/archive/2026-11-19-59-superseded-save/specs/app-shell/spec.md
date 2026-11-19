# Spec Delta

## ADDED Requirements

### Requirement: Older failed saves stay superseded
When an older save fails after a newer version was scheduled, the older version SHALL not be kept for a later save, so
it can never overwrite the newer edits.

#### Scenario: Old fails while new is queued
- **WHEN** the save of version "old" is running, version "new" is scheduled and flushed, and the "old" save fails
- **THEN** "new" is saved, nothing is pending afterwards, and the next flush writes nothing
