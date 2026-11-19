# media-specs Specification

## Purpose
Provides one authoritative catalogue of the media assets that the Apple App Store, Google Play and the web require,
and checks generated files against it, so every generator produces store-conform output.

## Requirements

### Requirement: Catalogue covers every store and web media asset
The system SHALL provide a catalogue entry for every media asset listed in the store media research:
App Store screenshots for every iPhone display class (including iPhone Duo outer and inner displays), iPad, Mac,
Apple TV, Vision Pro and Apple Watch; App Store app previews per device; product page header, search results and
universal creative assets; in-app event card and details media; the App Store app icon; the Google Play app icon,
feature graphic, phone, 7-inch and 10-inch tablet, Chromebook, Wear OS, Android TV, Android XR and Android Automotive
screenshots, Android TV banner and adaptive launcher icon layers; and the web and social assets (favicons, touch
icon, manifest and maskable icons, Open Graph, X card, WhatsApp preview, social profile and banner images).

#### Scenario: Looking up the required iPhone screenshot
- **WHEN** the catalogue is asked for the App Store screenshot entry of the 6.3-inch iPhone display class
- **THEN** it returns an entry with portrait sizes 1179×2556 and 1206×2622, marked as required, without alpha, in PNG or JPEG

#### Scenario: Looking up the iPhone Duo screenshots
- **WHEN** the catalogue is asked for the App Store screenshot entries of iPhone Duo
- **THEN** it returns one entry for the outer display (1398×2034) and one for the inner display (2007×2853), both optional

#### Scenario: Looking up an unknown asset
- **WHEN** the catalogue is asked for an asset id that does not exist
- **THEN** it reports that the asset is unknown instead of returning an empty entry

### Requirement: Every entry states its constraints and source
Every catalogue entry SHALL state its target (App Store, Google Play or web), whether it is required or optional,
the allowed dimensions (fixed sizes, or minimum and maximum with an aspect ratio rule), the allowed formats, whether
alpha is allowed, required or forbidden, a file size limit when one exists, count limits when they exist, video
limits (duration, frame rate) for video assets, whether the asset is localized, a verified flag and a source URL.

#### Scenario: Every entry is complete
- **WHEN** all catalogue entries are listed
- **THEN** each one has a target, a required flag, at least one dimension rule, at least one format, an alpha rule, a verified flag and a source URL

#### Scenario: Unverified sizes are marked
- **WHEN** the entry for the Instagram profile picture is looked up
- **THEN** it is marked as not verified

### Requirement: Catalogue can be filtered by target
The system SHALL list the catalogue entries of one target, optionally only the required ones.

#### Scenario: Required Google Play assets
- **WHEN** the required entries of Google Play are listed
- **THEN** the list contains the app icon, the feature graphic and the phone screenshots

### Requirement: Generated files are validated against their entry
The system SHALL check the measured properties of a generated file (width, height, format, alpha, byte size, and for
video duration and frame rate) against a catalogue entry and SHALL report every violation at once, each with a
readable message. A file that satisfies all rules SHALL produce no violations.

#### Scenario: A valid App Store screenshot
- **WHEN** a 1206×2622 PNG without alpha of 2 MB is validated against the 6.3-inch iPhone screenshot entry
- **THEN** no violation is reported

#### Scenario: A screenshot with wrong size and alpha
- **WHEN** a 1200×2600 PNG with alpha is validated against the 6.3-inch iPhone screenshot entry
- **THEN** two violations are reported: one for the dimensions and one for the alpha channel

#### Scenario: A Play icon that is too large
- **WHEN** a 512×512 PNG of 1.5 MB is validated against the Google Play app icon entry
- **THEN** a violation for the file size limit of 1024 KB is reported

#### Scenario: A range-based asset
- **WHEN** a 2400×1600 PNG is validated against the search results image entry (3:2, 1920×1280 to 3840×2560)
- **THEN** no violation is reported, and a 1000×667 PNG reports a dimension violation

#### Scenario: A video outside the duration limit
- **WHEN** a 35-second 886×1920 MP4 is validated against the iPhone app preview entry
- **THEN** a violation for the 15 to 30 second duration limit is reported

### Requirement: Image files can be measured
The system SHALL measure an image file on disk and return its width, height, format, alpha presence and byte size,
so that it can be validated. A file that is not a readable image SHALL produce a clear error.

#### Scenario: Measuring a PNG with alpha
- **WHEN** a 64×32 PNG with an alpha channel is measured
- **THEN** the result is width 64, height 32, format PNG, alpha present and the file's byte size

#### Scenario: Measuring a file that is not an image
- **WHEN** a text file is measured
- **THEN** an error states that the file is not a supported image

### Requirement: Document assets
The catalogue SHALL contain document entries for files that belong to an asset set but are not images or videos,
starting with the web app manifest (JSON) and the head snippet (HTML). Document entries SHALL state their format and
SHALL have no pixel dimensions.

#### Scenario: Web manifest entry
- **WHEN** the entry for the web app manifest is looked up
- **THEN** it is a document of format JSON without pixel dimensions

### Requirement: ICO files can be measured
The system SHALL measure ICO files and report the size of their largest image, the format ICO, alpha presence and the
byte size, so favicons can be validated like other images.

#### Scenario: Measuring a favicon with three sizes
- **WHEN** an ICO file with 16, 32 and 48 pixel images is measured
- **THEN** the result is 48×48, format ICO, with alpha, and the file's byte size

### Requirement: App icon appearances and layers
The catalogue SHALL contain entries for the dark and tinted appearances of the iOS app icon and for the background and
foreground layers used by Icon Composer, each 1024×1024 PNG. The background layer SHALL be opaque; the appearances and
the foreground layer MAY be transparent.

#### Scenario: Icon Composer background layer
- **WHEN** the entry for the Icon Composer background layer is looked up
- **THEN** it is a 1024×1024 PNG without alpha

### Requirement: Android launcher resources in one folder
The catalogue SHALL place the adaptive icon layers, the legacy launcher icon and the adaptive icon XML document
(`ic_launcher.xml`, format XML) in one shared folder for Android resources.

#### Scenario: Adaptive icon XML entry
- **WHEN** the entry for the adaptive icon XML is looked up
- **THEN** it is a document of format XML in the Android resources folder

### Requirement: Render defaults for screenshots
A spec entry with a range size rule MAY carry a default render size, which SHALL satisfy its own size rule. Google Play
screenshot entries SHALL carry the overlay text limit of 20 % and mark device frames as discouraged.

#### Scenario: Default sizes are valid
- **WHEN** the catalogue is checked
- **THEN** the default sizes of `google.screenshot.phone` (1080×1920), `google.screenshot.tablet-7` (1080×1920) and `google.screenshot.tablet-10` (1440×2560) satisfy their size rules, and no fixed-size entry has a default size

### Requirement: Logo variant entries
The catalogue SHALL contain `web.logo.monochrome`, `web.logo.inverse` and `web.logo.mark`: web target, group `logo`,
1024×1024 PNG with alpha, not localized, tool-defined.

#### Scenario: Variant entry
- **WHEN** `web.logo.mark` is looked up
- **THEN** it requires a 1024×1024 PNG with an alpha channel
