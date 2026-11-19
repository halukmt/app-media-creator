## ADDED Requirements

### Requirement: Text drawn completely
Text drawn as glyph paths (app name, tagline, headlines) SHALL be written as valid SVG path data at every position and
size: coordinates with at most two decimals and never `NaN` or exponent notation, so the whole text is rendered.

#### Scenario: Name without a tagline
- **WHEN** share images are generated for a project named "Demo" with a dark background and no tagline for tr-TR
- **THEN** the tr-TR X card, the de-DE Open Graph image, the Facebook cover and the LinkedIn banner show the whole name, more than 150 px of white ink right of the logo

#### Scenario: Coordinate a hair off an integer
- **WHEN** a glyph command ends at y = 314.00000000000006
- **THEN** the path data contains `314`, not `NaN`
