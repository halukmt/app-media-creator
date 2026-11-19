# screenshot-sets Specification

## Purpose
Ordered screenshot sets per language with their texts, and the generation of store screenshot cards for the device
matrix in one, several or all languages.

## Requirements

### Requirement: Screenshot set per language
The system SHALL keep, per language, an ordered list of at most 10 entries, each an uploaded screenshot with a headline
and a subline (up to 200 characters each), plus one card style (layout and background) for the project. New uploads
of a language SHALL be appended to its set unless the user already removed them from it; entries whose screenshot was
deleted SHALL be dropped without losing the other entries, texts or the style. Saving SHALL reject
unknown screenshots, a screenshot listed twice, more than 10 entries, unsupported languages and an invalid style.

#### Scenario: Uploads in order
- **WHEN** `start.png` and then `teams.png` are uploaded for German
- **THEN** the German set lists `start.png` first and `teams.png` second

#### Scenario: Deleted upload
- **WHEN** the German set has a (Erste) and b (Zweite) with the layout text-bottom, and a is deleted
- **THEN** the set reads b with "Zweite" and the layout is still text-bottom

#### Scenario: Removed from the set
- **WHEN** the German set is saved with a only although b was uploaded, and then c is uploaded
- **THEN** the set reads a, c

#### Scenario: Reordering keeps texts
- **WHEN** the German set "a (Erste), b (Zweite)" is saved in the order b, a
- **THEN** the set reads b with "Zweite" first and a with "Erste" second

#### Scenario: Invalid set
- **WHEN** a set lists a screenshot twice, a screenshot that was never uploaded, or the language `pt-BR`
- **THEN** saving is rejected with one message per problem

### Requirement: Fallback to the source language
A language without an own set SHALL use the source language's set. Cards made from a screenshot of another language
SHALL be marked as fallback input, which the export checklist reports as a warning.

#### Scenario: Turkish without screenshots
- **WHEN** only German (the source language) has screenshots and cards are generated for German and Turkish
- **THEN** the Turkish cards are marked as fallback input and the checklist says they were made from the de-DE input

### Requirement: Card generation for the device matrix
The system SHALL render, for each selected language, each device the project picked from the device matrix of an
enabled store, and each entry of the language's set up to the device's catalogue maximum, one card at the device's size
into `<target>/<locale>/<device>/NN-<name>.png`. Everything SHALL be rendered and validated before anything is written; then each selected language SHALL replace its
earlier cards of all matrix devices. A set below a device's catalogue minimum SHALL produce a warning. The run SHALL be
rejected when no device is picked or no language has screenshots.

#### Scenario: Two languages, two devices
- **WHEN** German has `start.png`, the project picks iPhone 6.3" and the Play phone, and cards are generated for all languages (German, Turkish)
- **THEN** `apple/de-DE/iphone-6.3/01-start.png`, `apple/tr-TR/iphone-6.3/01-start.png`, `google/de-DE/phone/01-start.png` and `google/tr-TR/phone/01-start.png` are written

#### Scenario: Unpicked device
- **WHEN** cards were generated for iPhone 6.3", the project now picks iPhone 6.9" instead, and cards are generated again
- **THEN** only the iPhone 6.9" cards remain

#### Scenario: One language
- **WHEN** cards are generated for `tr-TR` only
- **THEN** only Turkish cards are written

#### Scenario: Google Play maximum
- **WHEN** German has 9 screenshots and only the Play phone is picked
- **THEN** 8 cards are written

### Requirement: Per-slot style
A slot SHALL be able to override the section's layout, background and frame (`device` or `none`); without an override
the section style applies. `device` SHALL mean the device's default frame, so Google Play stays without a frame.

#### Scenario: No frame on one slot
- **WHEN** a slot is saved with the frame `none` and the layout `text-bottom`
- **THEN** its card renders differently from the section style and the stored slot keeps both overrides

### Requirement: Card preview
The system SHALL render a small preview of one slot of a language's effective set on a matrix device, with the device's
aspect ratio and the warnings of the full card; a slot beyond the device's catalogue maximum SHALL carry a warning that
it is not exported. Unknown devices and missing slots SHALL be rejected.

#### Scenario: Preview size
- **WHEN** the first German slot is previewed on `apple.screenshot.iphone-6.3`
- **THEN** the image is 360 px wide and as tall as the 1179 × 2556 ratio requires

#### Scenario: Beyond the Play maximum
- **WHEN** the ninth slot is previewed on `google.screenshot.phone`
- **THEN** the preview warns that the screenshot is not exported

### Requirement: Uploaded screenshots for thumbnails
The system SHALL serve an uploaded screenshot only when the requested path is exactly a listed raster screenshot upload,
with `X-Content-Type-Options: nosniff` and a sandboxing content security policy; any other path SHALL get 404.

#### Scenario: Not a screenshot
- **WHEN** the logo, `project.json`, a path with `../` or an empty path is requested
- **THEN** the answer is 404

### Requirement: Background choices
The system SHALL offer the neutral presets and, when a readable logo exists, backgrounds from its colours; an unreadable
logo SHALL leave the presets available.

#### Scenario: No logo
- **WHEN** the background choices are requested without a logo
- **THEN** the presets are listed and the logo backgrounds are empty

### Requirement: Languages without screenshots are cleaned up
Generating a language that has no screenshots (own or source) SHALL remove its earlier cards and report it as skipped,
as long as the project has any screenshot at all.

#### Scenario: German screenshot deleted
- **WHEN** German and Turkish had cards, the German screenshot is deleted and German is generated again
- **THEN** German is reported as skipped and only the Turkish cards remain

### Requirement: Saves are based on a revision
The stored screenshot sets SHALL carry a revision that every save increases. A save through the API SHALL name the
revision it is based on; a save based on an older revision SHALL be rejected with 409 and the current sets, and
nothing SHALL be written. Saves SHALL run one after another, so two saves based on the same revision cannot both pass.
The Screenshots section SHALL send its edits based on the revision of its last save or load, and on a conflict SHALL
drop the refused edit, load the current sets and say that they were changed elsewhere.

#### Scenario: Two tabs
- **WHEN** another tab saves the sets and this tab then saves an edit based on the earlier revision
- **THEN** this tab's save is refused, it shows the other tab's text and a note that the screenshots were changed elsewhere

#### Scenario: Applying AI headlines
- **WHEN** AI headlines are applied to the sets
- **THEN** the revision increases, so a page still based on the earlier revision cannot save over them

#### Scenario: Save without a revision
- **WHEN** `PUT /api/screenshots` is sent without a revision
- **THEN** it is rejected with 400

### Requirement: A conflict drops every edit not yet sent
When a save of the screenshot sets is refused as a conflict, the Screenshots section SHALL drop every edit not yet
sent, including saves already queued behind the refused one, so none of them can be sent with a newer revision. After
loading a newer version, the card previews SHALL show it.

#### Scenario: Several slow saves queued
- **WHEN** three saves are queued and the first one is refused as a conflict
- **THEN** the other two are never sent
