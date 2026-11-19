# Spec Delta

## ADDED Requirements

### Requirement: Device matrix
The device models a project can pick SHALL be the device matrix: `apple.screenshot.iphone-6.9`, `iphone-6.5`,
`iphone-6.3`, `iphone-duo-outer`, `iphone-duo-inner` and `ipad-13` for the App Store, and `google.screenshot.phone`,
`tablet-7` and `tablet-10` for Google Play. Other screenshot specs SHALL be rejected as devices when settings are saved; when stored settings are read, such
devices SHALL be dropped so older project files stay readable.

#### Scenario: Device outside the matrix
- **WHEN** project settings pick `apple.screenshot.apple-tv` as an App Store device
- **THEN** the save is rejected with a message naming the device

#### Scenario: Older project file
- **WHEN** a stored project.json lists `apple.screenshot.apple-tv` next to `apple.screenshot.iphone-6.3`
- **THEN** reading the settings returns only `apple.screenshot.iphone-6.3`
