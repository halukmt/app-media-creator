# android-icons Specification

## Purpose
Generates the Google Play Store icon and the Android launcher icon resources (adaptive layers in every density, legacy
icons and the adaptive icon XML) from the uploaded logo, in the Android resource folder layout.

## Requirements

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

### Requirement: Background cut-out decided once per logo
The silhouette (Android monochrome layer, web monochrome and inverse variants, blueprint icons) SHALL cut the
background colour out of an opaque logo only when most of the logo's border shares one corner's flat colour and part
of the logo differs from it. Otherwise it SHALL keep the logo's full coverage. The decision SHALL be the same for every size
rendered from one logo.

#### Scenario: One-colour opaque logo
- **WHEN** the monochrome layer is generated from an opaque JPEG that is one solid colour
- **THEN** `ic_launcher_monochrome.png` is opaque across the logo box and transparent outside it

#### Scenario: Gradient mark
- **WHEN** the monochrome layer is generated from an opaque JPEG filled edge to edge with a gradient
- **THEN** `ic_launcher_monochrome.png` is opaque across the logo box

#### Scenario: Line art on white at every density
- **WHEN** the monochrome layer is generated from an opaque JPEG with a thin ring on white
- **THEN** at mdpi and at xxxhdpi the ring is opaque and the white inside the ring and in the corner of the logo box is transparent

#### Scenario: Cropped wordmark
- **WHEN** the monochrome layer is generated from an opaque JPEG wordmark whose letters touch the top and bottom edge on white
- **THEN** the letters are opaque and the white between them is transparent

### Requirement: Greyscale logos in silhouettes
Every pixel analysis of a logo raster (palette, background analysis, silhouette cut) SHALL read the pixels as 8-bit
sRGB with alpha, so greyscale and 16-bit logos are handled like colour logos.

#### Scenario: Greyscale logo on white
- **WHEN** the monochrome layer is generated from an opaque one-channel greyscale PNG with a dark block on white
- **THEN** the block is opaque and the white around it is transparent

#### Scenario: 16-bit greyscale raster
- **WHEN** a 16-bit greyscale PNG is read for analysis
- **THEN** the pixels come as 4 bytes per pixel with the grey value in each colour channel
