# Spec Delta

## ADDED Requirements

### Requirement: Per-slot style
A slot SHALL be able to override the section's layout, background and frame (`device` or `none`); without an override
the section style applies. `device` SHALL mean the device's default frame, so Google Play stays without a frame.

#### Scenario: No frame on one slot
- **WHEN** a slot is saved with the frame `none` and the layout `text-bottom`
- **THEN** its card renders differently from the section style and the stored slot keeps both overrides

### Requirement: Card preview
The system SHALL render a small preview of one slot of a language's effective set on a matrix device, with the device's
aspect ratio and the warnings of the full card; a slot beyond the device's catalogue maximum SHALL carry a warning that
it is not exported. Unknown devices and missing slots SHALL be rejected.

#### Scenario: Preview size
- **WHEN** the first German slot is previewed on `apple.screenshot.iphone-6.3`
- **THEN** the image is 360 px wide and as tall as the 1179 × 2556 ratio requires

#### Scenario: Beyond the Play maximum
- **WHEN** the ninth slot is previewed on `google.screenshot.phone`
- **THEN** the preview warns that the screenshot is not exported

### Requirement: Uploaded screenshots for thumbnails
The system SHALL serve an uploaded screenshot only when the requested path is exactly a listed raster screenshot upload,
with `X-Content-Type-Options: nosniff` and a sandboxing content security policy; any other path SHALL get 404.

#### Scenario: Not a screenshot
- **WHEN** the logo, `project.json`, a path with `../` or an empty path is requested
- **THEN** the answer is 404

### Requirement: Background choices
The system SHALL offer the neutral presets and, when a readable logo exists, backgrounds from its colours; an unreadable
logo SHALL leave the presets available.

#### Scenario: No logo
- **WHEN** the background choices are requested without a logo
- **THEN** the presets are listed and the logo backgrounds are empty

### Requirement: Languages without screenshots are cleaned up
Generating a language that has no screenshots (own or source) SHALL remove its earlier cards and report it as skipped,
as long as the project has any screenshot at all.

#### Scenario: German screenshot deleted
- **WHEN** German and Turkish had cards, the German screenshot is deleted and German is generated again
- **THEN** German is reported as skipped and only the Turkish cards remain
