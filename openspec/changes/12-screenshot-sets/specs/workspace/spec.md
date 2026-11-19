# Spec Delta

## ADDED Requirements

### Requirement: Device matrix
The device models a project can pick SHALL be the device matrix: `apple.screenshot.iphone-6.9`, `iphone-6.5`,
`iphone-6.3`, `iphone-duo-outer`, `iphone-duo-inner` and `ipad-13` for the App Store, and `google.screenshot.phone`,
`tablet-7` and `tablet-10` for Google Play. Other screenshot specs SHALL be rejected as devices.

#### Scenario: Device outside the matrix
- **WHEN** project settings pick `apple.screenshot.apple-tv` as an App Store device
- **THEN** the save is rejected with a message naming the device
