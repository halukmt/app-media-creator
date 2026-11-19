## ADDED Requirements

### Requirement: A conflict drops every edit not yet sent
When a save of the screenshot sets is refused as a conflict, the Screenshots section SHALL drop every edit not yet
sent, including saves already queued behind the refused one, so none of them can be sent with a newer revision. After
loading a newer version, the card previews SHALL show it.

#### Scenario: Several slow saves queued
- **WHEN** three saves are queued and the first one is refused as a conflict
- **THEN** the other two are never sent
