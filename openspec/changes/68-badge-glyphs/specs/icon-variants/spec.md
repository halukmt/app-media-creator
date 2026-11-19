## ADDED Requirements

### Requirement: Drawable environment labels
Project validation SHALL reject an environment label that contains characters without a glyph in the icon font.
The error SHALL be reported at `environments.<n>.badge` and SHALL name those characters. The Project screen SHALL
show the error at the label field. Labels in Latin script, including Turkish and German letters, SHALL stay valid.

#### Scenario: Cyrillic label
- **WHEN** a project is saved with the environment label `ТЕСТ`
- **THEN** the save fails with "environments.0.badge: these characters cannot be drawn on the icon: Т Е С", and the label field is marked invalid

#### Scenario: Turkish letters
- **WHEN** a project is saved with the environment label `İŞÜÖÄĞÇ`
- **THEN** the save succeeds
