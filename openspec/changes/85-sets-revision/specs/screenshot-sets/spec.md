## ADDED Requirements

### Requirement: Saves are based on a revision
The stored screenshot sets SHALL carry a revision that every save increases. A save through the API SHALL name the
revision it is based on; a save based on an older revision SHALL be rejected with 409 and the current sets, and
nothing SHALL be written. Saves SHALL run one after another, so two saves based on the same revision cannot both pass.
The Screenshots section SHALL send its edits based on the revision of its last save or load, and on a conflict SHALL
drop the refused edit, load the current sets and say that they were changed elsewhere.

#### Scenario: Two tabs
- **WHEN** another tab saves the sets and this tab then saves an edit based on the earlier revision
- **THEN** this tab's save is refused, it shows the other tab's text and a note that the screenshots were changed elsewhere

#### Scenario: Applying AI headlines
- **WHEN** AI headlines are applied to the sets
- **THEN** the revision increases, so a page still based on the earlier revision cannot save over them

#### Scenario: Save without a revision
- **WHEN** `PUT /api/screenshots` is sent without a revision
- **THEN** it is rejected with 400
