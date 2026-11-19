## MODIFIED Requirements

### Requirement: Locale selection supports one, several or all
The system SHALL resolve a locale selection given as a single locale, a list of locales or "all" into an ordered list
without duplicates, in catalogue order. An unknown locale SHALL be rejected with a message naming it, also when the
list contains "all".

#### Scenario: Selecting all locales
- **WHEN** the selection "all" is resolved
- **THEN** the six locales are returned in catalogue order

#### Scenario: Selecting several locales with a duplicate
- **WHEN** the selection `tr-TR`, `de-DE`, `tr-TR` is resolved
- **THEN** `de-DE` and `tr-TR` are returned in catalogue order

#### Scenario: Selecting an unsupported locale
- **WHEN** the selection `pt-BR` is resolved
- **THEN** it is rejected with a message that `pt-BR` is not a supported locale

#### Scenario: All with an unsupported locale
- **WHEN** the selection "all", `pt-BR` is resolved
- **THEN** it is rejected with a message that `pt-BR` is not a supported locale
