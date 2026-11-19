## ADDED Requirements

### Requirement: Background cut-out decided once per logo
The silhouette (Android monochrome layer, web monochrome and inverse variants, blueprint icons) SHALL cut the
background colour out of an opaque logo only when most of the logo's border shares one corner's flat colour and part
of the logo differs from it. Otherwise it SHALL keep the logo's full coverage. The decision SHALL be the same for every size
rendered from one logo.

#### Scenario: One-colour opaque logo
- **WHEN** the monochrome layer is generated from an opaque JPEG that is one solid colour
- **THEN** `ic_launcher_monochrome.png` is opaque across the logo box and transparent outside it

#### Scenario: Gradient mark
- **WHEN** the monochrome layer is generated from an opaque JPEG filled edge to edge with a gradient
- **THEN** `ic_launcher_monochrome.png` is opaque across the logo box

#### Scenario: Line art on white at every density
- **WHEN** the monochrome layer is generated from an opaque JPEG with a thin ring on white
- **THEN** at mdpi and at xxxhdpi the ring is opaque and the white inside the ring and in the corner of the logo box is transparent

#### Scenario: Cropped wordmark
- **WHEN** the monochrome layer is generated from an opaque JPEG wordmark whose letters touch the top and bottom edge on white
- **THEN** the letters are opaque and the white between them is transparent
