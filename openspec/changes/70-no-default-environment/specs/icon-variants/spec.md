## MODIFIED Requirements

### Requirement: Environments in the project settings
The project settings SHALL list non-production environments. Each environment SHALL have:
- an id: lower-case letters, digits and dashes, starting with a letter, not `production`, `shared` or a lower-case
  language code such as `de-de`, unique;
- a badge text of 1 to 10 characters, stored upper-case;
- a colour preset: orange, purple, green, red, blue or gray;
- a style: `badge` or `blueprint`.

There SHALL be at most 5 environments. A new project and a project file without the field SHALL have no
environments. The Project screen SHALL let the user add, edit and remove environments and SHALL show each error next
to its field; the first environment added SHALL be suggested as `preview` (PREVIEW, orange, badge).

#### Scenario: Older project file
- **WHEN** a project file without `environments` is read
- **THEN** the project has no environments and the icon generators write only the production icons

#### Scenario: Project file with environments
- **WHEN** a project file lists the environment `preview`
- **THEN** the project keeps it unchanged

#### Scenario: Reserved name
- **WHEN** an environment named `shared` is saved on the Project screen
- **THEN** the save fails and the folder name field of that environment shows the error and gets focus
