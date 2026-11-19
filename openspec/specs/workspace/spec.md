# workspace Specification

## Purpose
Keeps a user's project settings, uploaded inputs and generated media in a folder inside their own repo, and offers a
safe local API to read and change it.

## Requirements

### Requirement: Workspace folder
The system SHALL use a workspace folder given on the command line, or `.app-media/` in the current directory when
none is given. On start it SHALL create the folder with `project.json`, `inputs/`, `jobs/` and `output/` if they are
missing, and SHALL leave existing content unchanged.

#### Scenario: First start in a repo
- **WHEN** the tool starts in a directory without `.app-media/`
- **THEN** `.app-media/` is created with a default `project.json` and the folders `inputs/`, `jobs/` and `output/`

#### Scenario: Existing workspace
- **WHEN** the tool starts with a workspace that already has a `project.json`
- **THEN** the existing settings are kept

### Requirement: Project settings
The project settings SHALL contain the app name, the enabled targets (App Store, Google Play, web), the device models
per target, the source locale, the selected locales and the claims (allowed and forbidden statements). New projects
SHALL select all 6 locales. Device models SHALL be screenshot entries of the spec catalogue that belong to the target.
Saving SHALL reject invalid settings with a message per invalid field and SHALL leave the stored settings unchanged.

#### Scenario: Default settings
- **WHEN** the settings of a new workspace are read
- **THEN** all 6 locales are selected, the source locale is `en-US` and App Store, Google Play and web are enabled

#### Scenario: Saving valid settings
- **WHEN** settings with the app name "Demo", the locales `de-DE` and `tr-TR` and the App Store device `apple.screenshot.iphone-6.9` are saved
- **THEN** reading the settings returns exactly these values

#### Scenario: Selecting all locales
- **WHEN** settings are saved with the locale selection "all"
- **THEN** the stored settings list all 6 locales in catalogue order

#### Scenario: Rejecting an invalid device and locale
- **WHEN** settings with the device `google.screenshot.phone` under App Store and the locale `pt-BR` are saved
- **THEN** the save is rejected with messages naming the device and the locale, and the stored settings are unchanged

#### Scenario: Source locale outside the selection
- **WHEN** settings with source locale `de-DE` and selected locales `en-US` only are saved
- **THEN** the save is rejected because the source locale must be selected

### Requirement: Input uploads
The system SHALL store an uploaded logo, screenshot or video under `inputs/` in the workspace: the logo once,
screenshots and videos per locale (the source locale when none is given). It SHALL accept logos as PNG, JPEG, WebP or
SVG up to 10 MB, screenshots as PNG, JPEG or WebP up to 20 MB and videos as MP4, MOV or M4V up to 500 MB, checked by
the file content and not only by the name. It SHALL list all stored inputs grouped by kind and locale.

#### Scenario: Uploading a screenshot for a locale
- **WHEN** a PNG screenshot is uploaded for `tr-TR`
- **THEN** it is stored under the `tr-TR` screenshots of the workspace and appears in the input list for `tr-TR`

#### Scenario: Rejecting a file with a fake extension
- **WHEN** a text file named `shot.png` is uploaded as a screenshot
- **THEN** the upload is rejected because the file is not a PNG, JPEG or WebP image

#### Scenario: Rejecting a file that is too large
- **WHEN** a logo larger than 10 MB is uploaded
- **THEN** the upload is rejected with a message naming the 10 MB limit

#### Scenario: Rejecting an unsupported locale
- **WHEN** a screenshot is uploaded for the locale `pt-BR`
- **THEN** the upload is rejected with a message naming `pt-BR`

#### Scenario: Path traversal in the file name
- **WHEN** a screenshot is uploaded with the file name `../../outside.png`
- **THEN** the file is stored inside the workspace inputs with a safe name, and nothing is written outside the workspace

### Requirement: Local API protection
The local server SHALL listen only on the local machine. It SHALL reject requests that change data when they come from
another website (an `Origin` that is not the tool itself) or carry a host name other than `localhost` or `127.0.0.1`.

#### Scenario: Request from another website
- **WHEN** a page on another origin sends an upload to the local server
- **THEN** the request is rejected and nothing is stored

#### Scenario: Request from the tool's own UI
- **WHEN** the tool's UI sends the same upload
- **THEN** the upload is stored

### Requirement: Device matrix
The device models a project can pick SHALL be the device matrix: `apple.screenshot.iphone-6.9`, `iphone-6.5`,
`iphone-6.3`, `iphone-duo-outer`, `iphone-duo-inner` and `ipad-13` for the App Store, and `google.screenshot.phone`,
`tablet-7` and `tablet-10` for Google Play. Other screenshot specs SHALL be rejected as devices when settings are saved; when stored settings are read, such
devices SHALL be dropped so older project files stay readable.

#### Scenario: Device outside the matrix
- **WHEN** project settings pick `apple.screenshot.apple-tv` as an App Store device
- **THEN** the save is rejected with a message naming the device

#### Scenario: Older project file
- **WHEN** a stored project.json lists `apple.screenshot.apple-tv` next to `apple.screenshot.iphone-6.3`
- **THEN** reading the settings returns only `apple.screenshot.iphone-6.3`
