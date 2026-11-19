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

### Requirement: Drawer dismissal on narrow screens
When the sections menu was opened from the top bar, closing it without choosing a section (Escape or a tap outside the
menu) SHALL return keyboard focus to the menu button. Growing the window to the wide layout while the menu is open
SHALL leave every control of the page usable.

#### Scenario: Escape returns focus
- **WHEN** the menu is open on a 375 px wide screen and the user presses Escape
- **THEN** the menu is hidden and the "Open sections menu" button has focus

#### Scenario: Window grows to the wide layout
- **WHEN** the menu is open on a 375 px wide screen and the window is resized to 1280 px
- **THEN** the App name field of the Project screen can be focused and edited

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

### Requirement: A download belongs to its selection
The Export section SHALL run at most one ZIP download at a time. When the selected languages or the saved project
change while a download runs, the section SHALL abort it, SHALL NOT save its ZIP and SHALL NOT show its result.

#### Scenario: Languages change during a download
- **WHEN** the user starts the download for German and selects Turkish before the ZIP has arrived
- **THEN** no ZIP is saved, no success message is shown and the Download button is active for the new selection

#### Scenario: Second start while a download runs
- **WHEN** a download is running and the user activates Download again
- **THEN** no second export request is sent

### Requirement: Screenshots section
The Screenshots section SHALL guide through the steps Upload, Purpose, Preview and edit, and Export. Later steps SHALL
be unavailable, with a reason, until a screenshot is uploaded. The user SHALL be able to upload screenshots for a chosen
language, choose store screenshots with headline or frame only (header / search asset and feature graphic shown as
coming later), edit headline, subline and the style per slot, reorder and remove slots by keyboard, see the rendered
card of every slot for a chosen device with its validation state, and generate the languages of the locale bar.

#### Scenario: Two languages to the ZIP
- **WHEN** a screenshot is uploaded for German and one for Turkish, the German headline is edited and the screenshots are generated
- **THEN** the ZIP downloaded in the Export section contains `apple/de-DE/iphone-6.3/01-start.png`, `apple/tr-TR/iphone-6.3/01-baslangic.png` and `google/de-DE/phone/01-start.png`

#### Scenario: Reorder by keyboard
- **WHEN** the button "Move screenshot 1 down" is pressed with the keyboard
- **THEN** "Moved to position 2 of 2." is announced and the headline stays with its screenshot

#### Scenario: Purposes that come later
- **WHEN** the Purpose step is shown
- **THEN** "Feature graphic" and the header / search asset cannot be chosen and are marked "Comes later"

#### Scenario: Narrow screen
- **WHEN** the Preview and edit step is shown 375 px wide
- **THEN** the page has no horizontal scrolling and no serious or critical accessibility violations

### Requirement: Unsaved screenshot edits are kept
Edits in the Screenshots section SHALL be saved one save at a time with the newest version winning. When a save fails,
the edits SHALL stay pending and on screen, and upload and generate SHALL not start but report that the latest changes
could not be saved.

#### Scenario: Save fails, then succeeds
- **WHEN** an edit is scheduled, the save fails, and the save is tried again and succeeds
- **THEN** the first attempt is reported as failed and the second attempt saves the same edit

#### Scenario: Newer edit during a failing save
- **WHEN** a save is running, a newer edit is made, and the running save fails
- **THEN** the next save stores the newer edit

### Requirement: Older failed saves stay superseded
When an older save fails after a newer version was scheduled, the older version SHALL not be kept for a later save, so
it can never overwrite the newer edits.

#### Scenario: Old fails while new is queued
- **WHEN** the save of version "old" is running, version "new" is scheduled and flushed, and the "old" save fails
- **THEN** "new" is saved, nothing is pending afterwards, and the next flush writes nothing

### Requirement: Edits made just before leaving a section are not lost
The system SHALL send a pending edit when the user leaves the Logo, Screenshots or Store texts section and SHALL let
the Export page and a section opened again read the stored data only after that save has settled. When such a save
fails, the app shell SHALL show an error naming the section with a link back to it; when it is dropped because the
data changed elsewhere, a warning saying so. The message SHALL stay, also in the section opened again, until the user
dismisses it or a later save in that section works. Pages SHALL wait at most 10 seconds for such saves.

#### Scenario: Export right after an edit
- **WHEN** the user changes a store text and clicks `Export →` before the autosave pause has passed
- **THEN** the Export page requests its checklist only after the store texts are saved

#### Scenario: The save after leaving fails
- **WHEN** the user changes a store text, clicks `Export →` and the save fails
- **THEN** the shell shows "Your last change in Store texts was not saved and is lost." with the link
  "Open Store texts and enter it again"

#### Scenario: The message stays until it is dismissed
- **WHEN** the user follows that link
- **THEN** the Store texts section shows the stored texts with the message above it, without the link
- **WHEN** the user dismisses the message
- **THEN** it is gone
