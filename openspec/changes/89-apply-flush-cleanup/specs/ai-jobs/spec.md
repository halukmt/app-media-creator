## ADDED Requirements

### Requirement: A failed save before applying leaves nothing pending
When the pending screenshot edits cannot be saved before applying AI headlines, the apply SHALL not start, the apply
buttons SHALL be usable again, and edits SHALL stay paused only if an earlier apply still waits for its reload.

#### Scenario: Save fails, apply not sent
- **WHEN** a headline was edited, saving fails and the user applies variant B
- **THEN** an error says the changes could not be saved, the paused note is not shown and both apply buttons are usable
