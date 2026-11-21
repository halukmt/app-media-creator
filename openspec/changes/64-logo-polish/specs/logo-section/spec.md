## MODIFIED Requirements

### Requirement: Generate all logo packs
The generate button SHALL name the number of chosen packs ("Generate 3 packs", "Generate 1 pack"). It SHALL save
pending options first and then generate every chosen pack with the stored background (and taglines for Social) for
the languages of the locale bar, with progress. A failed pack SHALL NOT stop the other packs.

#### Scenario: All packs to the ZIP
- **WHEN** a logo is uploaded, all packs are chosen, the generate button is pressed and the ZIP is downloaded in Export
- **THEN** the ZIP contains `apple/shared/icon/app-icon.png`, `google/shared/icon/play-icon.png`, `web/shared/favicons/favicon.ico` and `web/de-DE/og-image/01-og-image.png`

#### Scenario: Unknown pack
- **WHEN** `POST /api/generate/logo/print` is sent
- **THEN** the response is 400

### Requirement: Logo preview grid
The Preview step SHALL show one card per asset and language per pack: the largest image of the asset (240 px wide,
with a 480 px copy for HiDPI screens), its name, its size (or "N files · min–max px wide" for several sizes) and the
worst validation state of its files. Files without an image preview SHALL be shown after the images without media.
The note that sizes and limits come from third-party sources SHALL be shown once per pack that has such a file, not
on its cards; a card whose only message was that note SHALL show the state OK.

#### Scenario: Launcher icon densities
- **WHEN** the Google Play pack is generated
- **THEN** the legacy launcher icon is shown once with "5 files · 48–192 px wide"

#### Scenario: Third-party sizes
- **WHEN** a pack contains a file whose spec entry is not verified
- **THEN** the note is shown once under the pack heading and not in the messages of its cards

### Requirement: Output previews
`GET /api/output/file` SHALL serve only PNG, JPEG or WebP files listed in the output manifest that are regular files
inside the workspace output, with `X-Content-Type-Options: nosniff`, a sandbox CSP and no caching; an optional
`width` of 16–1024 SHALL return a downscaled PNG. Downscaled copies MAY be kept in memory, keyed by the file's size and
change time, so a replaced file is never answered with an old copy. Other paths SHALL be refused.

#### Scenario: Path outside the manifest
- **WHEN** a path that is not in the manifest, a document or a symbolic link is requested
- **THEN** the response is 404 or 400 and no file content is returned

#### Scenario: Replaced file
- **WHEN** a generated image is replaced on disk after its preview was served
- **THEN** the next preview request returns a copy of the new file

## ADDED Requirements

### Requirement: Current logo details
The current-logo card in Upload SHALL show the logo's size and format, or "SVG (vector)" for an SVG, and a validation
state from `GET /api/inputs/logo-info`: a warning when a raster logo's shorter side is smaller than the App Store icon
side from the specs catalogue, and a warning when the logo is not square.

#### Scenario: Small raster logo
- **WHEN** a 300 × 200 px PNG logo is uploaded
- **THEN** `GET /api/inputs/logo-info` returns status `warning` with the upscale and the not-square message

#### Scenario: No logo
- **WHEN** `GET /api/inputs/logo-info` is sent before a logo is uploaded
- **THEN** the response is 404
