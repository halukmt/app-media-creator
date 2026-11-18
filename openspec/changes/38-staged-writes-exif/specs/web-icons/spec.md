# Spec Delta

## ADDED Requirements

### Requirement: Logo orientation
The system SHALL render a raster logo in its displayed orientation, applying the orientation stored in its metadata
before resizing.

#### Scenario: JPEG logo rotated by EXIF
- **WHEN** the web icons are generated from a JPEG logo stored landscape with EXIF orientation 6
- **THEN** the logo appears upright (portrait) in the generated icons
