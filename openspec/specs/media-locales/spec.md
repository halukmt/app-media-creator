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
without duplicates, in catalogue order. An unknown locale SHALL be rejected with a message naming it.

#### Scenario: Selecting all locales
- **WHEN** the selection "all" is resolved
- **THEN** the six locales are returned in catalogue order

#### Scenario: Selecting several locales with a duplicate
- **WHEN** the selection `tr-TR`, `de-DE`, `tr-TR` is resolved
- **THEN** `de-DE` and `tr-TR` are returned in catalogue order

#### Scenario: Selecting an unsupported locale
- **WHEN** the selection `pt-BR` is resolved
- **THEN** it is rejected with a message that `pt-BR` is not a supported locale
