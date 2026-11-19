## ADDED Requirements

### Requirement: Greyscale logos in silhouettes
Every pixel analysis of a logo raster (palette, background analysis, silhouette cut) SHALL read the pixels as 8-bit
sRGB with alpha, so greyscale and 16-bit logos are handled like colour logos.

#### Scenario: Greyscale logo on white
- **WHEN** the monochrome layer is generated from an opaque one-channel greyscale PNG with a dark block on white
- **THEN** the block is opaque and the white around it is transparent

#### Scenario: 16-bit greyscale raster
- **WHEN** a 16-bit greyscale PNG is read for analysis
- **THEN** the pixels come as 4 bytes per pixel with the grey value in each colour channel
