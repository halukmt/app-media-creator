# Spec Delta

## Purpose

Generates the App Store icon, its dark and tinted appearances and the layer files for Icon Composer from the uploaded
logo, keeping the logo inside the area that stays visible after the system masks the icon.

## ADDED Requirements

### Requirement: App Store icon set from the logo
The system SHALL generate from the newest uploaded logo: an opaque 1024×1024 App Store icon with the logo on a
background colour, a 1024×1024 dark appearance and a 1024×1024 tinted appearance with the logo on a transparent
background (the tinted one in grey tones), and 1024×1024 background and foreground layers for Icon Composer, full
bleed and not pre-masked. Every file SHALL pass the validation of its catalogue entry.

#### Scenario: Generating from an SVG logo
- **WHEN** the App Store icons are generated from an SVG logo with the background `#0079dd`
- **THEN** `apple/shared/icon/` contains `app-icon.png`, `app-icon-dark.png` and `app-icon-tinted.png`, `apple/shared/icon-composer/` contains `background.png` and `foreground.png`, and `app-icon.png` has no alpha channel and `#0079dd` in its corners

#### Scenario: Generating from a transparent PNG logo
- **WHEN** the App Store icons are generated from a transparent PNG logo
- **THEN** the dark and tinted appearances and the foreground layer keep a transparent background and the tinted appearance has no colour

#### Scenario: Logo inside the safe area
- **WHEN** the App Store icons are generated with a logo scale of 0.9
- **THEN** the logo is fitted into 80 % of the canvas, the chosen safe limit inside the rounded mask

#### Scenario: No logo uploaded
- **WHEN** the App Store icons are requested and no logo has been uploaded
- **THEN** the request is rejected with a message asking for a logo

### Requirement: Logo palette
The system SHALL offer up to five main colours of the uploaded logo, most frequent first, ignoring transparent pixels,
as suggestions for background colours.

#### Scenario: Palette of a two-colour logo
- **WHEN** the palette of a logo that is mostly red with a smaller blue part is requested
- **THEN** red is the first colour and blue is among the suggestions
