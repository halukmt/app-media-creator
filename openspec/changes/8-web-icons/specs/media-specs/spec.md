# Spec Delta

## ADDED Requirements

### Requirement: Document assets
The catalogue SHALL contain document entries for files that belong to an asset set but are not images or videos,
starting with the web app manifest (JSON) and the head snippet (HTML). Document entries SHALL state their format and
SHALL have no pixel dimensions.

#### Scenario: Web manifest entry
- **WHEN** the entry for the web app manifest is looked up
- **THEN** it is a document of format JSON without pixel dimensions

### Requirement: ICO files can be measured
The system SHALL measure ICO files and report the size of their largest image, the format ICO, alpha presence and the
byte size, so favicons can be validated like other images.

#### Scenario: Measuring a favicon with three sizes
- **WHEN** an ICO file with 16, 32 and 48 pixel images is measured
- **THEN** the result is 48×48, format ICO, with alpha, and the file's byte size
