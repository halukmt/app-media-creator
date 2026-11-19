## ADDED Requirements

### Requirement: AI job folder
The tool SHALL prepare an AI job as `<workspace>/jobs/<id>/` with `brief.json`, `claims.json`, the screenshots of
each selected language under `images/` (the source language's when a language has none, marked as fallback), still
frames of uploaded videos under `frames/` when ffmpeg is available, and the JSON Schemas of the result files under
`schemas/`. Job ids SHALL have the form `YYYYMMDD-HHMMSS-xxxx`; nothing else in the jobs folder is a job.

#### Scenario: German and Turkish with German screenshots
- **WHEN** a job is prepared for German and Turkish and only German has screenshots
- **THEN** the brief lists the German screenshots for both languages, the Turkish ones marked as fallback, and each image is copied once

#### Scenario: No ffmpeg
- **WHEN** a video is uploaded and ffmpeg cannot be started
- **THEN** the job is created without frames and the brief notes that ffmpeg is missing

### Requirement: Validated AI results
The tool SHALL validate `headlines.json`, `store-texts/<locale>/<field>.md` and `storyboard.json` against their
schemas and the brief. A result naming an unknown screenshot, image or language, using a forbidden claim, using an
unknown store text field, or not being valid JSON SHALL make the job invalid; nothing of an invalid job SHALL be
exposed or applied.

#### Scenario: Forbidden claim
- **WHEN** a headline contains a claim listed as forbidden in `claims.json`
- **THEN** the job is invalid with an error naming the claim, and no headlines are offered

### Requirement: Applying headlines
The tool SHALL apply variant A or B of a valid job to the screenshot sets: each language gets its slots in brief
order with the new texts, existing style overrides are kept, and a language without its own set gets one with the
same screenshots. The job is then marked as applied.

#### Scenario: Variant B for a fallback language
- **WHEN** variant B is applied for German and Turkish while only German has screenshots
- **THEN** Turkish gets its own set with the German screenshots and the Turkish B headlines

### Requirement: Live job updates and the command to run
The server SHALL watch the jobs folder and send an event with the job id when its files change. The Screenshots
section SHALL prepare a job for the selected languages, show the command to run in Claude Code with a copy button,
update live when results arrive, compare variants A and B per language and apply one after a confirmation.

#### Scenario: Result written while the page is open
- **WHEN** the skill writes `headlines.json` into a waiting job
- **THEN** the page shows "Headlines are ready" with both variants without a reload
