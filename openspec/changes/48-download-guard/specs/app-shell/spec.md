## ADDED Requirements

### Requirement: A download belongs to its selection
The Export section SHALL run at most one ZIP download at a time. When the selected languages or the saved project
change while a download runs, the section SHALL abort it, SHALL NOT save its ZIP and SHALL NOT show its result.

#### Scenario: Languages change during a download
- **WHEN** the user starts the download for German and selects Turkish before the ZIP has arrived
- **THEN** no ZIP is saved, no success message is shown and the Download button is active for the new selection

#### Scenario: Second start while a download runs
- **WHEN** a download is running and the user activates Download again
- **THEN** no second export request is sent
