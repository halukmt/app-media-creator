## ADDED Requirements

### Requirement: A selection for a project stays inside the project's locales
The system SHALL resolve a locale selection for a project (export, every generator, AI jobs) with one rule: no
selection or "all" means the project's locales in catalogue order; a single locale or a list keeps only the named
locales. Every entry SHALL be checked against the catalogue first; a supported locale outside the project SHALL be
rejected with a message naming every such locale.

#### Scenario: All on a two-locale project
- **WHEN** a project has the locales `de-DE` and `en-US`, screenshots exist for `de-DE` and `tr-TR`, and framed
  screenshots are generated with the selection "all"
- **THEN** files are written for `de-DE` only, none for `tr-TR`

#### Scenario: A locale outside the project
- **WHEN** a project has the locales `de-DE` and `en-US` and a generator is called with `fr-FR`
- **THEN** it is rejected with the message that `fr-FR` is not a locale of this project and nothing is written

#### Scenario: All next to an unsupported locale
- **WHEN** the selection "all", `pt-BR` is resolved for a project
- **THEN** it is rejected with the message that `pt-BR` is not a supported locale

#### Scenario: AI job for all locales
- **WHEN** a project has the locales `de-DE` and `tr-TR` and an AI job is created with the selection "all"
- **THEN** the job brief lists `de-DE` and `tr-TR`
