## ADDED Requirements

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
