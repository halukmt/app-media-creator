# share-images Specification

## Purpose
Share images per locale, social profile and banner images and logo variants, generated from the uploaded logo.

## Requirements

### Requirement: Share images per locale
The system SHALL generate, for each selected locale, the Open Graph image (1200×630 PNG), the X card (1200×628 PNG)
and the WhatsApp preview (1200×630 JPEG of at most 300 KB) with the logo, the app name and the locale's tagline when
one is given; each file SHALL pass the validation of its catalogue entry. Taglines SHALL be at most 120 characters and
only for supported locales.

#### Scenario: German and Turkish taglines
- **WHEN** share images are generated with a German and a Turkish tagline
- **THEN** `web/de-DE/og-image/01-og-image.png` and `web/tr-TR/og-image/01-og-image.png` exist, differ, pass their spec, and no character is reported as missing

#### Scenario: WhatsApp size
- **WHEN** the WhatsApp preview is generated
- **THEN** the JPEG is at most 300 KB

#### Scenario: Invalid tagline
- **WHEN** a tagline is given for `pt-BR`
- **THEN** the request is rejected naming the locale

### Requirement: Social images shared by all locales
The system SHALL generate every social profile picture (logo centred, small enough for a circle crop), banner (logo
and name centred, inside the safe area when the catalogue has one) and the email signature logo (on transparency) at
the catalogue sizes, and flag the unverified sizes in the export checklist.

#### Scenario: Unverified banner size
- **WHEN** the export checklist is built after generating the social images
- **THEN** the YouTube banner has a warning that its size comes from third-party sources

### Requirement: Logo variants
The system SHALL generate a monochrome (black), an inverse (white) and a square-mark variant of the logo, 1024×1024
PNG on transparency.

#### Scenario: One colour
- **WHEN** the variants are generated from a red and blue logo
- **THEN** every visible pixel of the monochrome variant is black and every visible pixel of the inverse variant is white

### Requirement: Text drawn completely
Text drawn as glyph paths (app name, tagline, headlines) SHALL be written as valid SVG path data at every position and
size: coordinates with at most two decimals and never `NaN` or exponent notation, so the whole text is rendered.

#### Scenario: Name without a tagline
- **WHEN** share images are generated for a project named "Demo" with a dark background and no tagline for tr-TR
- **THEN** the tr-TR X card, the de-DE Open Graph image, the Facebook cover and the LinkedIn banner show the whole name, more than 150 px of white ink right of the logo

#### Scenario: Coordinate a hair off an integer
- **WHEN** a glyph command ends at y = 314.00000000000006
- **THEN** the path data contains `314`, not `NaN`
