# Spec Delta

## ADDED Requirements

### Requirement: Subfolders are part of the set position
Registering a file SHALL replace an earlier file only when spec, locale, subfolder and position are all the same (or
the path is the same), so parallel sets in different subfolders (for example `1x` and `2x`) are kept side by side.

#### Scenario: 1x and 2x
- **WHEN** the same spec, locale and position are registered once in subfolder `1x` and once in `2x`
- **THEN** the manifest lists both `web/de-DE/framed-screenshots/1x/01-start.png` and `web/de-DE/framed-screenshots/2x/01-start.png`
