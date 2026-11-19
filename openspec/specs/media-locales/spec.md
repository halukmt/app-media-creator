# media-locales Specification

## Purpose
Defines the media languages the tool generates assets for, how they map to App Store Connect and Google Play locale
codes, and how users select one, several or all of them.

## Requirements

### Requirement: Six media locales with store codes
The system SHALL support exactly these media locales: German `de-DE`, English (US) `en-US`, Spanish `es-ES`,
Italian `it-IT`, French `fr-FR` and Turkish `tr-TR`. Each locale SHALL have an English display name, a native display
name, an App Store Connect code and a Google Play code.

#### Scenario: Italian and Turkish App Store Connect codes
- **WHEN** the App Store Connect codes of Italian and Turkish are requested
- **THEN** they are `it` and `tr`

#### Scenario: Google Play codes
- **WHEN** the Google Play codes of all locales are requested
- **THEN** they are `de-DE`, `en-US`, `es-ES`, `it-IT`, `fr-FR` and `tr-TR`

#### Scenario: Native names
- **WHEN** the native display name of `tr-TR` is requested
- **THEN** it is "Türkçe"

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
