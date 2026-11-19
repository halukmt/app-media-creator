## ADDED Requirements

### Requirement: Environments in the project settings
The project settings SHALL list non-production environments. Each environment SHALL have:
- an id: lower-case letters, digits and dashes, starting with a letter, not `production` or `shared`, unique;
- a badge text of 1 to 10 characters, stored upper-case;
- a colour preset: orange, purple, green, red, blue or gray;
- a style: `badge` or `blueprint`.

There SHALL be at most 5 environments. A project file without the field SHALL get one `preview` environment
(PREVIEW, orange, badge). The Project screen SHALL let the user add, edit and remove environments and SHALL show each
error next to its field.

#### Scenario: Older project file
- **WHEN** a project file without `environments` is read
- **THEN** the project has the environment `preview` with badge PREVIEW, colour orange and style badge

#### Scenario: Reserved name
- **WHEN** an environment named `shared` is saved on the Project screen
- **THEN** the save fails and the folder name field of that environment shows the error and gets focus

### Requirement: Icon variant styles
The badge style SHALL draw the production icon with a label pill in the environment colour, at the bottom centre of
the circle that stays visible under the platform mask:
- radius 0.46 of the icon size for store, touch, launcher and manifest icons;
- 33/108 for adaptive layers;
- 0.4 for maskable icons.

Icons under 64 px SHALL get a colour bar along the bottom edge instead of a label. The blueprint style SHALL draw the
logo outline in white on a blue gradient with grid lines, plus the label.

#### Scenario: Badge colour
- **WHEN** the App Store icons are generated with a white background and the environment preview (orange, badge)
- **THEN** `apple/preview/icon/app-icon.png` is white in the corner and has the colour #c2410c in the label row

#### Scenario: Blueprint background
- **WHEN** the App Store icons are generated for an environment with style blueprint
- **THEN** its icon has no alpha channel and a dominant blue colour

### Requirement: Icon variants per environment
The App Store, Android and web icon generators SHALL write, for every project environment, the same set as for
production into `<target>/<environment>/…`, with these exceptions:
- the Play icon has no variants;
- the monochrome adaptive layer is the production silhouette;
- the web manifest name ends with ` (<badge>)`.

Production files SHALL stay byte-identical. Each generator SHALL replace its whole set, so the files of an environment
that was removed from the project are deleted.

#### Scenario: Two environments from a flat PNG logo
- **WHEN** a flat PNG logo is uploaded, the environments preview and dev exist, and the App Store, Android and web icons are generated
- **THEN** `apple/preview/icon/`, `google/dev/android-res/mipmap-*/` and `web/preview/favicons/` hold valid files, and the production files equal those of a project without environments

#### Scenario: Environment removed
- **WHEN** the environment dev is removed and the App Store icons are generated again
- **THEN** the manifest has no files of dev and still has those of preview
