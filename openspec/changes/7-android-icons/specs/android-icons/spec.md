# Spec Delta

## Purpose

Generates the Google Play Store icon and the Android launcher icon resources (adaptive layers in every density, legacy
icons and the adaptive icon XML) from the uploaded logo, in the Android resource folder layout.

## ADDED Requirements

### Requirement: Google Play icon
The system SHALL generate a 512×512 32-bit PNG of at most 1024 KB from the newest uploaded logo: a full square without
rounding or shadow, the logo on the background colour, and the logo box clamped to at most 80 % of the canvas.

#### Scenario: Play icon from an SVG logo
- **WHEN** the Android icons are generated from an SVG logo with the background `#0079dd`
- **THEN** `google/shared/icon/play-icon.png` is a 512×512 PNG with an alpha channel, fully opaque, with `#0079dd` in its corners

### Requirement: Android launcher resources
The system SHALL generate, for each density mdpi, hdpi, xhdpi, xxhdpi and xxxhdpi, the adaptive icon layers
`ic_launcher_background.png` (opaque background colour), `ic_launcher_foreground.png` (the logo on transparency,
inside the 66 dp safe circle) and `ic_launcher_monochrome.png` (a one-colour silhouette of the logo on transparency) at
108 dp, and the legacy `ic_launcher.png` at 48 dp, in `mipmap-<density>` folders, plus
`mipmap-anydpi-v26/ic_launcher.xml` that references the three layers. Every image SHALL pass the validation of its
catalogue entry.

#### Scenario: Density folders
- **WHEN** the Android icons are generated
- **THEN** `google/shared/android-res/mipmap-xxxhdpi/ic_launcher_foreground.png` is 432×432 and `google/shared/android-res/mipmap-mdpi/ic_launcher.png` is 48×48

#### Scenario: Foreground inside the safe zone
- **WHEN** the foreground layer is generated for xxxhdpi (432 px for 108 dp)
- **THEN** every visible logo pixel lies inside the central circle of 264 px (66 dp) diameter, also for a square logo

#### Scenario: Monochrome silhouette
- **WHEN** the monochrome layer is generated from a two-colour logo
- **THEN** every visible pixel has the same colour and the background stays transparent

#### Scenario: Adaptive icon XML
- **WHEN** the Android icons are generated
- **THEN** `mipmap-anydpi-v26/ic_launcher.xml` declares background, foreground and monochrome drawables `@mipmap/ic_launcher_background`, `@mipmap/ic_launcher_foreground` and `@mipmap/ic_launcher_monochrome`

#### Scenario: No logo uploaded
- **WHEN** the Android icons are requested and no logo has been uploaded
- **THEN** the request is rejected with a message asking for a logo
