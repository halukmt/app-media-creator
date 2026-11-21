# promo-videos Specification

## Purpose
TBD - created by archiving change 22-amc-video-promo. Update Purpose after archive.

## Requirements

### Requirement: Promo video specs
The specs catalogue SHALL contain `web.promo.landscape` (1920 × 1080), `web.promo.vertical` (1080 × 1920),
`web.promo.square` (1080 × 1080) and `google.promo-video` (1920 × 1080, the file for the YouTube URL of the Play
listing), as MP4 videos with a length range, `verified: false` and a source URL.

#### Scenario: Play promo
- **WHEN** the catalogue is read
- **THEN** `google.promo-video` is a localized 1920 × 1080 MP4 entry with `verified: false`

### Requirement: Promo video job
`POST /api/jobs` with `task: promo-video` SHALL write a brief with `promo` (engine `brag`, formats with their exact
sizes, 15–30 s, 30 fps, website and repository when given, output `videos/<locale>/<format>.mp4`) and the command
`/amc-video "<job folder>"`. It SHALL need Google Play or Web / social and material: screenshots, a recording, or a
website or repository. Formats SHALL default to all three with Web on and SHALL be 16:9 only with Google Play alone.
Unknown formats and URLs that are not http or https (or contain credentials) SHALL be rejected with 400.

#### Scenario: Repository only
- **WHEN** a promo job is requested with a repository and no uploads
- **THEN** the job is created and its brief names the repository

#### Scenario: No material
- **WHEN** a promo job is requested without uploads, website or repository
- **THEN** the request fails with "Upload screenshots or a screen recording, or give the website or repository of the app"

### Requirement: Promo video checks and outputs
Reading a promo job SHALL check every `videos/<locale>/<format>.mp4` with ffprobe against its spec; a wrong size,
another file name or language, a link or an unreadable file SHALL make the job invalid. Applying a ready job SHALL copy
each video into the outputs as the web promo of its format (Web on) and the 16:9 video also as `google.promo-video`
(Google Play on), replacing earlier promo videos of these languages, and mark the job applied for exactly these files.

#### Scenario: Apply a 16:9 reel
- **WHEN** a 1920 × 1080 MP4 is saved as `videos/de-DE/landscape.mp4` and the job is applied
- **THEN** the manifest lists `web/de-DE/promo-landscape/01-promo.mp4` and `google/de-DE/promo-video/01-promo.mp4`

#### Scenario: Wrong size
- **WHEN** a 1920 × 1080 video is saved as `videos/de-DE/square.mp4`
- **THEN** the job is invalid and nothing is applied

### Requirement: Promo reel in the Video section
The Video section SHALL offer "Promo reel" as a purpose when Google Play or Web is on, also without a recording. Its
options SHALL be the formats and an optional website and repository (http or https, saved with the video settings).
Its Export step SHALL show the AI job panel (prepare, command, status, add reels to outputs) and a note that Google
Play needs the 16:9 reel on YouTube.

#### Scenario: Promo flow
- **WHEN** the user prepares a promo job, a 16:9 reel appears in the job folder and the user adds it to the outputs
- **THEN** the results show "Promo reel 16:9" and "Promo video for YouTube (Google Play)"

### Requirement: amc-video skill
The package SHALL ship `skills/amc-video` with a SKILL.md that renders with brag (install instructions, `--no-music` by
default), promo rules and a check script that agrees with the tool on sizes, names and languages. THIRD_PARTY_NOTICES
SHALL list brag (MIT) and HyperFrames (Apache-2.0).

#### Scenario: Check script
- **WHEN** the check script runs on a job with a 16:9 video saved as `square.mp4`
- **THEN** it exits with 1 and names the expected size
