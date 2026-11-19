# video-assets Specification

## Purpose
TBD - created by archiving change 21-embed-loop-videos. Update Purpose after archive.

## Requirements

### Requirement: Device videos for web and social
The system SHALL put each screen recording of a selected project language (up to three) in a device frame on a
background in the formats 9:16 (1080×1920), 16:9 (1920×1080) and 1:1 (1080×1080), with an optional line of text per
language. The recording SHALL play inside the device screen, the frame SHALL be drawn over it, and the recording's
audio SHALL be kept. A language without recordings SHALL use the source language's and mark the videos as fallback
input. Every video SHALL be measured with ffprobe and validated against its catalogue entry before it is written.

#### Scenario: German and Turkish device videos
- **WHEN** a project with `de-DE` and `tr-TR` has one German recording and vertical and square videos are generated
  with a text per language
- **THEN** `web/de-DE/video-vertical/01-<name>.mp4`, `web/de-DE/video-square/01-<name>.mp4` and the same for `tr-TR`
  are written, the Turkish ones marked as fallback input, and the middle of the device screen shows the recording

#### Scenario: Invalid options
- **WHEN** a format other than vertical, landscape or square, an unknown frame or a text for a language outside the
  project is given
- **THEN** generating fails with a message naming the problem

### Requirement: Looping header and search videos
The system SHALL make the App Store's product page header video (3840×1646) and search results video (1920×1280) per
selected language from the first recording, in the layout of the header and search images with the language's phrase
and the recording playing in the key-art device. The end SHALL crossfade into the start so the loop has no jump; the
videos SHALL have 30 fps, 5–30 s and no audio track.

#### Scenario: Seamless loop
- **WHEN** the header video of `tr-TR` is generated from an 8 s recording
- **THEN** it is 3840×1646, about 7.5 s long, without audio, and the jump from its last frame to its first is no
  bigger than an ordinary step between two frames

#### Scenario: Too short for a loop
- **WHEN** the recording is 4 s long
- **THEN** generating fails with "The loop would last 3.5 s; it needs 5–30 s" and nothing is written
