## ADDED Requirements

### Requirement: Edit lock recovers with any reload
When the reload after applying AI headlines fails, screenshot edits SHALL stay blocked until the next successful
reload of the sets, whichever action causes it ("Try again", an upload, …); that reload SHALL release the lock after
the reloaded sets are rendered.

#### Scenario: Upload after a failed reload
- **WHEN** applying succeeded, the reload failed, and an upload then reloads the sets successfully
- **THEN** screenshot edits are taken again
