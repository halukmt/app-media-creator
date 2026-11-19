## ADDED Requirements

### Requirement: Logo section steps
The Logo section SHALL guide through the steps Upload, Options, Preview and Export. Later steps SHALL be unavailable,
with a reason, until a logo is uploaded.

#### Scenario: Upload a logo
- **WHEN** an SVG logo is uploaded in the Upload step
- **THEN** "Logo uploaded." is announced and the current logo is shown

#### Scenario: Narrow screen
- **WHEN** the Preview step is shown 375 px wide
- **THEN** the page has no horizontal scrolling and no serious or critical accessibility violations

### Requirement: Logo options
The Options step SHALL offer the packs App Store, Google Play, Web and Social, a solid background chosen from the
presets and the logo palette only, and a tagline per language of the locale bar when the Social pack is chosen.
Packs of stores turned off in Project SHALL be disabled with a note. Options SHALL be saved automatically to
`<workspace>/logo.json`; invalid or unreadable settings SHALL fall back to all packs, white and no taglines.

#### Scenario: Background from the presets
- **WHEN** the background "Navy" is chosen and a German tagline is typed
- **THEN** "Changes saved." is announced and `GET /api/logo/settings` returns that background and tagline

#### Scenario: Invalid settings
- **WHEN** `PUT /api/logo/settings` sends a tagline longer than 120 characters or an unsupported locale
- **THEN** the response is 400 and the stored settings are unchanged

### Requirement: Generate all logo packs
"Generate all" SHALL save pending options first and then generate every chosen pack with the stored background (and
taglines for Social) for the languages of the locale bar, with progress. A failed pack SHALL NOT stop the other packs.

#### Scenario: All packs to the ZIP
- **WHEN** a logo is uploaded, all packs are chosen, "Generate all" is pressed and the ZIP is downloaded in Export
- **THEN** the ZIP contains `apple/shared/icon/app-icon.png`, `google/shared/icon/play-icon.png`, `web/shared/favicons/favicon.ico` and `web/de-DE/og-image/01-og-image.png`

#### Scenario: Unknown pack
- **WHEN** `POST /api/generate/logo/print` is sent
- **THEN** the response is 400

### Requirement: Logo preview grid
The Preview step SHALL show one card per asset and language per pack: the largest image of the asset, its name, its
size (or "N files · min–max px wide" for several sizes) and the worst validation state of its files. Files without an
image preview SHALL be shown after the images without media.

#### Scenario: Launcher icon densities
- **WHEN** the Google Play pack is generated
- **THEN** the legacy launcher icon is shown once with "5 files · 48–192 px wide"

### Requirement: Output previews
`GET /api/output/file` SHALL serve only PNG, JPEG or WebP files listed in the output manifest that are regular files
inside the workspace output, with `X-Content-Type-Options: nosniff`, a sandbox CSP and no caching; an optional
`width` of 16–1024 SHALL return a downscaled PNG. Other paths SHALL be refused.

#### Scenario: Path outside the manifest
- **WHEN** a path that is not in the manifest, a document or a symbolic link is requested
- **THEN** the response is 404 or 400 and no file content is returned
