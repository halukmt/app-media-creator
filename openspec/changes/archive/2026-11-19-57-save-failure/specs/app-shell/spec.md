# Spec Delta

## ADDED Requirements

### Requirement: Unsaved screenshot edits are kept
Edits in the Screenshots section SHALL be saved one save at a time with the newest version winning. When a save fails,
the edits SHALL stay pending and on screen, and upload and generate SHALL not start but report that the latest changes
could not be saved.

#### Scenario: Save fails, then succeeds
- **WHEN** an edit is scheduled, the save fails, and the save is tried again and succeeds
- **THEN** the first attempt is reported as failed and the second attempt saves the same edit

#### Scenario: Newer edit during a failing save
- **WHEN** a save is running, a newer edit is made, and the running save fails
- **THEN** the next save stores the newer edit
