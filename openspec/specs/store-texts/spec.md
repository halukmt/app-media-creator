# store-texts Specification

## Purpose
App Store and Google Play listing texts per locale: the catalogue of fields and limits, the stored document, the
Store texts section and the texts in the export (#24).

## Requirements

### Requirement: Store text catalogue
`src/core/specs/texts.ts` SHALL list every store text field once with store, paste order, maximum length and its unit
(characters, or bytes for Apple keywords), required flag, `verified` flag and source URL: App Store name (30),
subtitle (30), promotional text (170), description (4000), keywords (100 bytes), what's new (4000); Google Play title
(30), short description (80), full description (4000). Lengths are counted after trimming.

#### Scenario: Keywords in Turkish
- **WHEN** Apple keywords hold 95 characters, some of them Turkish letters that take two bytes
- **THEN** the check counts bytes and reports an error when they exceed 100 bytes

#### Scenario: Advisory checks
- **WHEN** keywords repeat a word of the app name, contain a duplicate or a space after a comma, or the Play title
  has an emoji or is written in capitals
- **THEN** the check reports a warning, not an error

### Requirement: Store texts document
The workspace SHALL store the texts per locale and field in `store-texts.json` with a revision. A save names the
revision it is based on and is rejected with a conflict when the stored revision has moved on. Unknown locales or
fields are rejected; texts longer than a store limit are stored and reported by the checks.

#### Scenario: Stale save
- **WHEN** a page saves texts based on revision 3 while the stored revision is 4
- **THEN** nothing is written and the answer is a conflict with the current document

### Requirement: Store texts section
The Store texts section SHALL show, per selected language and enabled store, one field per store text in paste order
with a live counter of characters (bytes for Apple keywords) against the limit and the check messages, and save
changes automatically.

#### Scenario: Over the limit
- **WHEN** the user types a subtitle with 31 characters
- **THEN** the field shows 31 / 30 and an error, and the text is still saved

### Requirement: Store texts in the export
The ZIP SHALL contain the non-empty store texts of the selected locales for each enabled store as
`<target>/store-texts/<store locale code>/NN-<field>.txt` in paste order (App Store Connect codes such as `it` and
`tr` for Apple, Play codes for Google). Once a store has texts, the checklist SHALL check every selected locale of
that store: a missing required field or a text over its limit is an error.

#### Scenario: Italian App Store texts
- **WHEN** Italian has an App Store name and description and the export includes Italian
- **THEN** the ZIP holds `apple/store-texts/it/01-name.txt` and `apple/store-texts/it/04-description.txt`
