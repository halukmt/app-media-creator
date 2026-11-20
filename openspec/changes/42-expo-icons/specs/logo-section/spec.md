## ADDED Requirements

### Requirement: Expo icon pack
The Logo section SHALL offer an Expo icons pack, not chosen by default, while the App Store or Google Play is on. It
SHALL write, for the App Store, a 1024 × 1024 opaque iOS icon with dark and tinted appearances and an `app.json`
fragment with `ios.icon` (light, dark, tinted); for Google Play, a 1024 × 1024 legacy icon, adaptive foreground and
monochrome layers and a fragment with `android.icon` and `android.adaptiveIcon` (foregroundImage, monochromeImage,
backgroundColor = the Logo background). Only the stores turned on in Project SHALL be written, each in its `expo`
folder, the files of a store turned off since SHALL be removed, and every image SHALL be validated against its
catalogue entry.

#### Scenario: Both stores
- **WHEN** the Expo pack is generated with both app stores on and the background `#0079dd`
- **THEN** `apple/shared/expo/` holds `icon.png`, `icon-dark.png`, `icon-tinted.png` and `app.ios.json`, and
  `google/shared/expo/` holds `android-icon.png`, `adaptive-foreground.png`, `adaptive-monochrome.png` and
  `app.android.json` with `backgroundColor` `#0079dd`

#### Scenario: Only Google Play
- **WHEN** only Google Play is on
- **THEN** only the Google Play files are written

#### Scenario: No app store
- **WHEN** neither app store is on
- **THEN** generating fails with "Turn on the App Store or Google Play in Project to make Expo icons"
