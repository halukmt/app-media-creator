# Spec Delta

## MODIFIED Requirements

### Requirement: ZIP export by locale
The system SHALL export a ZIP that contains the registered files of the selected locales and all shared files, in the
output folder layout, plus a `CHECKLIST.md` at the root. The selection SHALL accept one locale, several locales or
"all" of the project's locales and SHALL reject locales the project does not use. Files of disabled targets SHALL
not be exported. Only files that lie inside the output folder and match the output layout SHALL be exported; other
manifest entries and links to files elsewhere SHALL be left out and reported in the checklist. Every file registered
by a generator SHALL stay exportable, whatever characters its name contains. When writing the ZIP fails, the export
SHALL end with an error and SHALL leave no partial ZIP behind.

#### Scenario: Exporting one locale
- **WHEN** a ZIP is exported for `de-DE` while files exist for `de-DE` and `tr-TR`
- **THEN** the ZIP contains the `de-DE` files, the shared files and `CHECKLIST.md`, and no `tr-TR` files

#### Scenario: Exporting all locales
- **WHEN** a ZIP is exported for "all"
- **THEN** the ZIP contains the files of every locale of the project

#### Scenario: Manifest entry pointing outside the output folder
- **WHEN** the manifest contains an entry with the path `../../.ssh/id_rsa`
- **THEN** the file is not exported and the checklist reports the invalid entry as an error

#### Scenario: Disabled target
- **WHEN** Google Play is disabled after Google Play files were generated
- **THEN** the ZIP contains no Google Play files

#### Scenario: Rejecting a locale outside the project
- **WHEN** a ZIP is requested for `fr-FR` while the project uses only `de-DE` and `en-US`
- **THEN** the request is rejected with a message naming `fr-FR`

#### Scenario: Name with dots
- **WHEN** a screenshot named `home.dark` is registered and a ZIP is exported
- **THEN** the ZIP contains `apple/de-DE/iphone-6.3/01-home.dark.png`

#### Scenario: Writing the ZIP fails
- **WHEN** the exports folder cannot be written
- **THEN** the export ends with an error, the tool keeps running and no partial ZIP remains
