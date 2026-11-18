# web-icons Specification

## Purpose
Generates the favicon and web app icon set of a website from the uploaded logo, ready to copy into the site root.

## Requirements

### Requirement: Web icon set from the logo
The system SHALL generate from the newest uploaded logo: `favicon.ico` with 16, 32 and 48 pixel images, `icon.svg`
with a light background and a dark background for dark mode, an opaque 180×180 `apple-touch-icon.png`, manifest icons
of 192×192 and 512×512, a 512×512 maskable icon whose logo stays inside the central safe circle, `site.webmanifest`
and `head.html` with the tags for the page head. Every file SHALL pass the validation of its catalogue entry and SHALL
be stored in one folder for web icons.

#### Scenario: Generating from an SVG logo
- **WHEN** the web icons are generated from an SVG logo
- **THEN** the folder `web/shared/favicons/` contains `favicon.ico`, `icon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `site.webmanifest` and `head.html`, and the export checklist reports no errors for them

#### Scenario: Generating from a PNG logo with transparency
- **WHEN** the web icons are generated from a transparent PNG logo
- **THEN** `apple-touch-icon.png` and `icon-maskable-512.png` have no alpha channel and show the logo on the background colour

#### Scenario: Dark mode in icon.svg
- **WHEN** `icon.svg` is generated with a light background `#ffffff` and a dark background `#111111`
- **THEN** it uses `#ffffff` by default and `#111111` inside a `prefers-color-scheme: dark` media query

#### Scenario: Manifest and head snippet
- **WHEN** the web icons are generated for the project "Demo"
- **THEN** `site.webmanifest` names "Demo", lists the 192, 512 and maskable icons and the theme colour, and `head.html` links `favicon.ico`, `icon.svg`, `apple-touch-icon.png` and `site.webmanifest`

#### Scenario: No logo uploaded
- **WHEN** the web icons are requested and no logo has been uploaded
- **THEN** the request is rejected with a message asking for a logo

### Requirement: Logo orientation
The system SHALL render a raster logo in its displayed orientation, applying the orientation stored in its metadata
before resizing.

#### Scenario: JPEG logo rotated by EXIF
- **WHEN** the web icons are generated from a JPEG logo stored landscape with EXIF orientation 6
- **THEN** the logo appears upright (portrait) in the generated icons
