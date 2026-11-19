## ADDED Requirements

### Requirement: Lost edits are kept per document
The system SHALL keep the outcome of a save made when leaving a section per saved document. A later save of one
document SHALL clear only that document's loss; the shell SHALL show one message per section, as an error when any of
its documents failed to save.

#### Scenario: A sibling save does not clear a loss
- **WHEN** the user leaves Screenshots, the screenshot sets fail to save and the header image settings are saved
- **THEN** the shell still shows that the last change in Screenshots was not saved

#### Scenario: Failure wins within a section
- **WHEN** the header image settings are dropped by a conflict and the screenshot sets fail to save
- **THEN** the shell shows one error for Screenshots
