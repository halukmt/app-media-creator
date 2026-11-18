# Spec Delta

## ADDED Requirements

### Requirement: Subfolders below an asset folder
A generated file MAY be placed in one subfolder below its asset folder (for example an Android density folder). The
subfolder name SHALL consist of lower-case letters, digits and dashes, and SHALL be part of the registered path, so the
manifest check reproduces it.

#### Scenario: Android density subfolder
- **WHEN** a launcher icon is registered with the subfolder `mipmap-hdpi`
- **THEN** its path is `google/shared/android-res/mipmap-hdpi/ic_launcher.png` and it survives reading the manifest again

#### Scenario: Invalid subfolder
- **WHEN** a file is registered with the subfolder `../x`
- **THEN** the registration is rejected
