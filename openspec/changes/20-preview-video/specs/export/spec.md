## ADDED Requirements

### Requirement: Videos are measured in the checklist
The export checklist SHALL measure every generated video with ffprobe and report each violation of its catalogue
entry (size, format, file size, duration, frame rate, stereo audio) as an error. When ffprobe cannot be started, it
SHALL report the video as not measured with a warning.

#### Scenario: A preview without audio
- **WHEN** a 9 s preview without an audio track is in the manifest
- **THEN** the checklist reports the duration outside 15–30 s and the missing stereo audio as errors

#### Scenario: No ffprobe
- **WHEN** ffprobe is missing
- **THEN** the preview item is a warning that names the missing program
