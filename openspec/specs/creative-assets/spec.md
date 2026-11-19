# creative-assets Specification

## Purpose
Store artwork per language from the screenshot sets, a background and one phrase per locale: App Store product page
header, search results and universal images (#18); Google Play feature graphic and App Store in-app event images (#19).

## Requirements

### Requirement: Creative asset settings
The workspace SHALL store the background and one phrase per locale for the App Store creative images in
`creative.json`. A phrase SHALL have at most 60 characters; blank phrases SHALL be dropped and unknown locales rejected.

#### Scenario: Phrase too long
- **WHEN** a phrase of 61 characters is saved
- **THEN** the save fails with an error that names the 60-character limit

### Requirement: Key art inside the safe area
The product page header, search results and universal images SHALL place the phrase and the key-art device inside the
art safe area of their catalogue spec, and the devices of the auxiliary area outside it.

#### Scenario: Phrase in another language
- **WHEN** the header image is rendered once with a German and once with a Turkish phrase
- **THEN** only pixels inside the safe area differ

### Requirement: Creative images per locale
The generator SHALL write, for every selected locale with screenshots, the header (3840×1646), search results
(3840×2560) and universal (5244×2950) image as PNG without alpha, valid for their specs, from the first three
screenshots of the locale's set; a locale without own screenshots SHALL use the source locale's and be marked as
fallback input. A locale without a phrase SHALL get a warning and images without text. Generation SHALL fail with a
message when the App Store is not enabled.

#### Scenario: German and Turkish
- **WHEN** a project with German and Turkish and German screenshots generates the creative images
- **THEN** six valid PNGs are written under `apple/<locale>/creative-…-image/` and the Turkish ones are marked as fallback input

#### Scenario: App Store disabled
- **WHEN** the App Store is disabled in the project
- **THEN** generation fails with a message to enable it

### Requirement: Creative preview with safe-area guide
The Screenshots section SHALL offer the purpose "Product page header and search asset" with a background choice and a
phrase field per selected language, and SHALL preview the three images of the editing language with their full size,
safe-area size and an optional dashed guide over the safe area.

#### Scenario: Guide toggle
- **WHEN** the preview shows the three images and the user turns "Show safe area" off
- **THEN** the guides disappear and the size line still names the safe area in pixels

### Requirement: Feature graphic and in-app event images
The generator SHALL offer a second group of store artwork for every selected locale with screenshots: the Google Play
feature graphic (1024×500, PNG without alpha) with the locale's phrase, and the App Store in-app event card
(3840×2160) and details image (2160×3840) without any text. Key art SHALL sit in a centred key area. Only images of
enabled stores SHALL be made; with neither store enabled, generation SHALL fail with a message.

#### Scenario: German and Turkish
- **WHEN** a project with German and Turkish (German screenshots only) generates the feature group
- **THEN** six valid images are written, the event images of both languages are identical and the feature graphics differ

#### Scenario: Only the App Store enabled
- **WHEN** Google Play is disabled
- **THEN** only the event card and details image are made

#### Scenario: Preview of the feature group
- **WHEN** the user picks "Feature graphic and in-app event images" in the Screenshots section and opens the preview
- **THEN** three previews show with the key area named in their size line, and the phrases of the header purpose are reused
