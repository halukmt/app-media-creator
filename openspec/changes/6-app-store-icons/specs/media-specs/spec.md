# Spec Delta

## ADDED Requirements

### Requirement: App icon appearances and layers
The catalogue SHALL contain entries for the dark and tinted appearances of the iOS app icon and for the background and
foreground layers used by Icon Composer, each 1024×1024 PNG. The background layer SHALL be opaque; the appearances and
the foreground layer MAY be transparent.

#### Scenario: Icon Composer background layer
- **WHEN** the entry for the Icon Composer background layer is looked up
- **THEN** it is a 1024×1024 PNG without alpha
