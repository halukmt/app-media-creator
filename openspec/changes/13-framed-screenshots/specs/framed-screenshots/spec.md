# Spec Delta

## Purpose

App screenshots in a device frame on a transparent background, per language, for use on websites.

## ADDED Requirements

### Requirement: Framed screenshot image
The system SHALL draw an uploaded screenshot in a device frame (generic or the user's bezel) on a transparent
background, without card background or text. With a shadow (the default) the image SHALL add a margin around the
device so the shadow is not cut; without a shadow the image SHALL be exactly the device width wide.

#### Scenario: Transparent corners
- **WHEN** a screenshot is framed with the iPhone frame at a device width of 400 px
- **THEN** the PNG has an alpha channel, its top-left pixel is fully transparent and its centre is opaque

#### Scenario: No shadow
- **WHEN** a screenshot is framed with the Android phone frame at 400 px without a shadow
- **THEN** the image is 400 px wide

### Requirement: Website screenshots per language
The system SHALL generate, for every selected language that has its own uploaded screenshots, one PNG and one WebP per
screenshot in `1x` (device 400 px wide, from `web.framed-screenshot`) and `2x`, into
`web/<locale>/framed-screenshots/<scale>x/NN-<name>.<ext>`, valid for `web.framed-screenshot` and
`web.framed-screenshot-webp`. Selected languages without own screenshots SHALL be skipped; when none of the selected
languages has screenshots, the request SHALL be rejected with a message to upload screenshots.

#### Scenario: German and Turkish
- **WHEN** German and Turkish each have the screenshot `start.png` and website screenshots are generated for all languages
- **THEN** eight files are written: `web/de-DE/framed-screenshots/1x/01-start.png`, `.webp`, the same in `2x`, and the same four for `tr-TR`

#### Scenario: 2x size
- **WHEN** website screenshots are generated for German
- **THEN** the `2x` PNG is twice as wide as the `1x` PNG (±1 px) and both keep their alpha channel

#### Scenario: No screenshots
- **WHEN** website screenshots are requested for French and French has no screenshots
- **THEN** the request is rejected with "Upload screenshots for fr-FR first"
