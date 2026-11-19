# Spec Delta

## ADDED Requirements

### Requirement: Logo variant entries
The catalogue SHALL contain `web.logo.monochrome`, `web.logo.inverse` and `web.logo.mark`: web target, group `logo`,
1024×1024 PNG with alpha, not localized, tool-defined.

#### Scenario: Variant entry
- **WHEN** `web.logo.mark` is looked up
- **THEN** it requires a 1024×1024 PNG with an alpha channel
