# export Specification

## Purpose
Collects every generated media file of a workspace, checks it against the store requirements and delivers it as one
ZIP in a store-ready folder layout, for one, several or all media locales.

## Requirements

### Requirement: Output folder layout
Generated files SHALL be stored under the workspace output folder as `<target>/<locale>/<asset>/NN-name.ext`
when the asset is localized, and as `<target>/shared/<asset>/name.ext` when it is not. `<asset>` is the device for
screenshots and otherwise the asset's own name, so two different assets never share a folder. `NN` is the two-digit order of
the file within its set. Every generated file SHALL be registered with its spec entry, locale (for localized assets),
order and whether it was made from a fallback input.

#### Scenario: Localized screenshot path
- **WHEN** the third 6.9-inch iPhone screenshot for `tr-TR` named "result" is registered
- **THEN** its path is `apple/tr-TR/iphone-6.9/03-result.png`

#### Scenario: Shared icon path
- **WHEN** the App Store icon is registered
- **THEN** its path is `apple/shared/icon/app-icon.png` and it has no locale

#### Scenario: Two assets of the same kind
- **WHEN** the Google Play icon and the legacy launcher icon are both registered with the name `icon`
- **THEN** they are stored in different folders and both stay in the export

#### Scenario: Replacing a set position
- **WHEN** screenshot 03 for `de-DE` is registered again under a new name
- **THEN** the previous file of position 03 is removed and only the new one is exported

#### Scenario: Registering a localized asset without a locale
- **WHEN** a localized asset is registered without a locale
- **THEN** the registration is rejected

### Requirement: Export checklist
The system SHALL build a checklist for every enabled target of the project and the selected locales. For every
required asset, every device model chosen in the project and every asset with registered files, it SHALL report:
an error when a required asset is missing for a locale (or missing as shared asset), an error when a set has fewer
files than the minimum or more than the maximum count, an error for every file that violates its spec, a warning
for files made from fallback inputs, a warning for unverified specs, and a warning for files that cannot be measured.
Assets that satisfy every rule SHALL be reported as ok.

#### Scenario: Missing required screenshots
- **WHEN** the checklist is built for `de-DE` and no 6.3-inch iPhone screenshots exist
- **THEN** the App Store section reports an error that the 6.3-inch iPhone screenshots are missing for `de-DE`

#### Scenario: A valid set
- **WHEN** three valid 6.3-inch iPhone screenshots exist for `de-DE`
- **THEN** that item is reported as ok for `de-DE`

#### Scenario: An invalid file
- **WHEN** a registered 6.3-inch iPhone screenshot has an alpha channel
- **THEN** the item reports an error naming the file and the alpha violation

#### Scenario: Too many files
- **WHEN** eleven 6.3-inch iPhone screenshots exist for one locale
- **THEN** the item reports an error that at most 10 are allowed

#### Scenario: Fallback input and unverified spec
- **WHEN** a screenshot was made from the source-language input for `it-IT`, and an X card is registered
- **THEN** the screenshot item carries a fallback warning and the X card item carries an unverified warning

#### Scenario: Disabled target
- **WHEN** Google Play is disabled in the project
- **THEN** the checklist has no Google Play section

### Requirement: ZIP export by locale
The system SHALL export a ZIP that contains the registered files of the selected locales and all shared files, in the
output folder layout, plus a `CHECKLIST.md` at the root. The selection SHALL accept one locale, several locales or
"all" of the project's locales and SHALL reject locales the project does not use. Files of disabled targets SHALL
not be exported. Only files that lie inside the output folder and match the output layout SHALL be exported; other
manifest entries and links to files elsewhere SHALL be left out and reported in the checklist. Every file registered
by a generator SHALL stay exportable, whatever characters its name contains. When writing the ZIP fails, the export
SHALL end with an error and SHALL leave no partial ZIP behind.

#### Scenario: Exporting one locale
- **WHEN** a ZIP is exported for `de-DE` while files exist for `de-DE` and `tr-TR`
- **THEN** the ZIP contains the `de-DE` files, the shared files and `CHECKLIST.md`, and no `tr-TR` files

#### Scenario: Exporting all locales
- **WHEN** a ZIP is exported for "all"
- **THEN** the ZIP contains the files of every locale of the project

#### Scenario: Manifest entry pointing outside the output folder
- **WHEN** the manifest contains an entry with the path `../../.ssh/id_rsa`
- **THEN** the file is not exported and the checklist reports the invalid entry as an error

#### Scenario: Disabled target
- **WHEN** Google Play is disabled after Google Play files were generated
- **THEN** the ZIP contains no Google Play files

#### Scenario: Rejecting a locale outside the project
- **WHEN** a ZIP is requested for `fr-FR` while the project uses only `de-DE` and `en-US`
- **THEN** the request is rejected with a message naming `fr-FR`

#### Scenario: Name with dots
- **WHEN** a screenshot named `home.dark` is registered and a ZIP is exported
- **THEN** the ZIP contains `apple/de-DE/iphone-6.3/01-home.dark.png`

#### Scenario: Writing the ZIP fails
- **WHEN** the exports folder cannot be written
- **THEN** the export ends with an error, the tool keeps running and no partial ZIP remains

### Requirement: Registered paths belong to one asset
The system SHALL reject registering a file at a path that is already registered for a different asset, so assets that
share a folder cannot overwrite each other.

#### Scenario: Same path for two assets
- **WHEN** a file is registered at a path that already belongs to another asset
- **THEN** the registration is rejected and the existing file stays unchanged

### Requirement: Batch registration is all or nothing
When several generated files are registered together and one of them cannot be written, the system SHALL leave every
previously registered file and the manifest unchanged and SHALL leave no temporary files behind.

#### Scenario: A file of the batch cannot be written
- **WHEN** a batch of two files is registered and the second target cannot be written
- **THEN** the registration fails, the first target still holds its previous content and the manifest is unchanged

### Requirement: Subfolders below an asset folder
A generated file MAY be placed in one subfolder below its asset folder (for example an Android density folder). The
subfolder name SHALL consist of lower-case letters, digits and dashes, and SHALL be part of the registered path, so the
manifest check reproduces it.

#### Scenario: Android density subfolder
- **WHEN** a launcher icon is registered with the subfolder `mipmap-hdpi`
- **THEN** its path is `google/shared/android-res/mipmap-hdpi/ic_launcher.png` and it survives reading the manifest again

#### Scenario: Invalid subfolder
- **WHEN** a file is registered with the subfolder `../x`
- **THEN** the registration is rejected

### Requirement: Subfolders are part of the set position
Registering a file SHALL replace an earlier file only when spec, locale, subfolder and position are all the same (or
the path is the same), so parallel sets in different subfolders (for example `1x` and `2x`) are kept side by side.

#### Scenario: 1x and 2x
- **WHEN** the same spec, locale and position are registered once in subfolder `1x` and once in `2x`
- **THEN** the manifest lists both `web/de-DE/framed-screenshots/1x/01-start.png` and `web/de-DE/framed-screenshots/2x/01-start.png`

### Requirement: Environment folders
A shared asset MAY be registered for a non-production environment. Its path SHALL be
`<target>/<environment>/<segment>[/<subfolder>]/<name>.<ext>`. The environment SHALL be part of the set position, and
a manifest entry SHALL only be accepted when its path matches that layout. Localized assets SHALL NOT have environment
variants. The export checklist SHALL check the files of each environment as their own, not required set. The ZIP SHALL
include them with the shared files.

#### Scenario: Path of a variant
- **WHEN** the path of `apple.icon` for the environment preview is computed
- **THEN** it is `apple/preview/icon/app-icon.png`, and the environment `shared` is rejected

#### Scenario: Checklist per environment
- **WHEN** the icons are generated for the environments preview and dev
- **THEN** the checklist has separate items for preview and dev, without errors
