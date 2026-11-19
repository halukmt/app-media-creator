## ADDED Requirements

### Requirement: Edits made just before leaving a section are not lost
The system SHALL send a pending edit when the user leaves the Logo, Screenshots or Store texts section and SHALL let
the Export page and a section opened again read the stored data only after that save has settled. When such a save
fails, the app shell SHALL show an error naming the section with a link back to it; when it is dropped because the
data changed elsewhere, a warning saying so. The message SHALL stay, also in the section opened again, until the user
dismisses it or a later save in that section works. Pages SHALL wait at most 10 seconds for such saves.

#### Scenario: Export right after an edit
- **WHEN** the user changes a store text and clicks `Export →` before the autosave pause has passed
- **THEN** the Export page requests its checklist only after the store texts are saved

#### Scenario: The save after leaving fails
- **WHEN** the user changes a store text, clicks `Export →` and the save fails
- **THEN** the shell shows "Your last change in Store texts was not saved and is lost." with the link
  "Open Store texts and enter it again"

#### Scenario: The message stays until it is dismissed
- **WHEN** the user follows that link
- **THEN** the Store texts section shows the stored texts with the message above it, without the link
- **WHEN** the user dismisses the message
- **THEN** it is gone
