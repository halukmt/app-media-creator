# app-shell Specification

## Purpose
The frame of the local UI: navigation between the sections, the Project screen that edits the workspace settings, the
shared locale selector and the empty states of sections that are not built yet.

## Requirements

### Requirement: Section navigation
The UI SHALL offer the sections Project, Logo, Screenshots, Video, Store texts and Export in this order in a sidebar.
The sidebar SHALL stay visible on wide screens and open from a top bar button on narrow screens. The current section
SHALL be reflected in the URL hash and marked as current in the navigation; an unknown or empty hash SHALL show the
Project section.

#### Scenario: Navigate to a section
- **WHEN** the user selects "Screenshots" in the navigation
- **THEN** the URL hash is `#/screenshots`, the main heading is "Screenshots" and the navigation marks it as current

#### Scenario: Reload keeps the section
- **WHEN** the UI is opened with the hash `#/video`
- **THEN** the Video section is shown

#### Scenario: Unknown section
- **WHEN** the UI is opened with the hash `#/does-not-exist`
- **THEN** the Project section is shown

#### Scenario: Narrow screen
- **WHEN** the UI is shown 375 px wide
- **THEN** the sidebar is hidden, a button opens it, and the page has no horizontal scrolling

### Requirement: Project screen
The Project screen SHALL show the current workspace settings and let the user edit the app name, each target's enabled
state and device models, the source locale, the selected locales and the allowed and forbidden claims (one claim per
line). Saving SHALL store the settings in the workspace; validation messages from the server SHALL be shown and the
entered values kept.

#### Scenario: Save settings
- **WHEN** the user changes the app name to "Demo", disables Google Play and saves
- **THEN** reading the project settings returns the name "Demo" and Google Play disabled, and a success message is announced

#### Scenario: Invalid settings
- **WHEN** the user clears the app name and saves
- **THEN** the settings are not stored, an error message names the app name, and the field keeps the empty value

#### Scenario: Claims as lines
- **WHEN** the user enters three allowed claims on separate lines, one of them blank, and saves
- **THEN** the stored allowed claims are the two non-blank lines, trimmed

### Requirement: Locale selector
The UI SHALL provide one locale selector that offers "All languages" and each of the 6 locales by name. In
multi-select mode it SHALL toggle single locales, select all with "All languages" and never leave the selection empty.
In single mode it SHALL select exactly one locale. It SHALL only offer the locales it is given.

#### Scenario: Select all
- **WHEN** only `de-DE` is selected and the user chooses "All languages"
- **THEN** all offered locales are selected

#### Scenario: Last locale stays
- **WHEN** only `tr-TR` is selected and the user deselects `tr-TR`
- **THEN** `tr-TR` stays selected

#### Scenario: Single locale
- **WHEN** the selector is in single mode with `de-DE` and the user chooses `tr-TR`
- **THEN** only `tr-TR` is selected

#### Scenario: Project locales
- **WHEN** the project selects `de-DE` and `tr-TR` only
- **THEN** the locale bar of a localized section offers only `de-DE` and `tr-TR`

### Requirement: Empty states
Each section without its own UI yet (Logo, Screenshots, Video, Store texts, Export) SHALL explain what to upload or
do and which of the enabled stores need it.

#### Scenario: Screenshots empty state
- **WHEN** the Screenshots section is opened with App Store and web enabled and Google Play disabled
- **THEN** it explains what screenshots to upload and names App Store and Web, but not Google Play

### Requirement: Catalogue for the UI
The server SHALL answer `GET /api/catalogue` with the supported locales (id, English name, native name) and, per target,
the device models (spec id, name, required flag, condition) that a project may select.

#### Scenario: Catalogue content
- **WHEN** the UI requests the catalogue
- **THEN** it lists 6 locales including `tr-TR` with the native name "Türkçe", and the App Store devices include `apple.screenshot.iphone-6.3`
