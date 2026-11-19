# store-preview-videos Specification

## Purpose
TBD - created by archiving change 20-preview-video. Update Purpose after archive.

## Requirements

### Requirement: App Store previews from screen recordings
The system SHALL turn each uploaded screen recording of a selected project language (up to three) into an App Store
preview for iPhone (886×1920) and, when the project picked an iPad screenshot size, for iPad (1200×1600); a landscape
recording SHALL get the landscape size. A language without recordings SHALL use the source language's recordings and
mark the previews as fallback input. Each preview SHALL be H.264 at 30 fps, 15–30 s long, with stereo AAC audio (a
silent track when the recording has none), measured with ffprobe and validated against the catalogue before it is
written.

#### Scenario: German and Turkish from one recording
- **WHEN** a project with `de-DE` and `tr-TR` has one 12 s German recording and previews are generated with text cards
- **THEN** `apple/de-DE/preview-iphone/01-<name>.mp4` and `apple/tr-TR/preview-iphone/01-<name>.mp4` are written,
  16 s long, 886×1920 with stereo audio, and the Turkish one is marked as fallback input

#### Scenario: Landscape recording without audio
- **WHEN** the recording is landscape, has no audio and the project picked an iPad size
- **THEN** the iPad preview is 1600×1200 and has a silent stereo track

### Requirement: Trim, fades and text cards
The system SHALL use the trimmed part of the recording, scale it into the store size without cropping (bars in the
card background colour), fade every part in and out, and add optional text cards per language before and after the
recording (1–5 s each). When the total would exceed 30 s, the recording SHALL be cut at the end with a warning; when
it would be shorter than 15 s, generating SHALL fail before anything is written.

#### Scenario: Too short
- **WHEN** a 6 s recording without cards is generated
- **THEN** generating fails with "The preview would last 6 s; the App Store needs 15–30 s" and nothing is written

### Requirement: Clear messages for missing tools and iPhone Duo
The system SHALL report whether ffmpeg and ffprobe can be started (`GET /api/video/tools`), SHALL fail with a message
naming the missing program and its variable (`FFMPEG_PATH`, `FFPROBE_PATH`), and SHALL warn that iPhone Duo previews
are experimental when the project picked an iPhone Duo size.

#### Scenario: ffprobe missing
- **WHEN** previews are generated and ffprobe cannot be started
- **THEN** the request fails with 400 and a message that ffprobe was not found

### Requirement: Frames of a generated preview
The system SHALL return one frame of a generated preview as PNG at a given second (0–30), to choose the poster frame
that App Store Connect sets per preview. Only manifest entries of preview videos SHALL be read.

#### Scenario: A path that is not a preview
- **WHEN** a frame of `../project.json` is requested
- **THEN** the request fails with "There is no generated preview video at this path"
