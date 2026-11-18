# Spec Delta

## ADDED Requirements

### Requirement: Render defaults for screenshots
A spec entry with a range size rule MAY carry a default render size, which SHALL satisfy its own size rule. Google Play
screenshot entries SHALL carry the overlay text limit of 20 % and mark device frames as discouraged.

#### Scenario: Default sizes are valid
- **WHEN** the catalogue is checked
- **THEN** the default sizes of `google.screenshot.phone` (1080×1920), `google.screenshot.tablet-7` (1080×1920) and `google.screenshot.tablet-10` (1440×2560) satisfy their size rules, and no fixed-size entry has a default size
