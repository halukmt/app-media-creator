# Spec Delta

## ADDED Requirements

### Requirement: Export checklist in the UI
The Export section SHALL show the export checklist for the languages selected in its locale bar: the overall status
and, per enabled store, every asset set with its name, language (for localized sets), required marker, status
(ok, warning or error, shown as text and not by colour alone) and messages, sets with errors first. Changing the
language selection SHALL reload the checklist.

#### Scenario: Checklist for one language
- **WHEN** the Export section is opened, a German iPhone 6.3" screenshot and an App Store icon are generated, and only German is selected
- **THEN** the App Store card lists the iPhone 6.3" set for `de-DE` as ok and lists no set for `tr-TR`

#### Scenario: Missing required asset
- **WHEN** the Google Play icon has not been generated
- **THEN** the Google Play card lists the Play icon with the status error and the message that it is required but missing

### Requirement: ZIP download from the UI
The Export section SHALL offer a download of the ZIP for the selected languages, saved under the file name the server
sends. While the checklist status is error, the section SHALL explain that the ZIP is incomplete and ask for a
confirmation before downloading; cancelling SHALL not download anything.

#### Scenario: Download after confirmation
- **WHEN** required assets are missing, German is selected and the user chooses Download and confirms
- **THEN** a ZIP is saved that contains `apple/de-DE/iphone-6.3/01-start.png` and `CHECKLIST.md` and no `tr-TR` file

#### Scenario: Cancel the confirmation
- **WHEN** required assets are missing and the user chooses Download and then cancels
- **THEN** no file is downloaded
