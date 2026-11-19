## ADDED Requirements

### Requirement: The amc-copy skill
The package SHALL ship the Claude Code skill `amc-copy` in `skills/amc-copy/` (installable with
`npx skills add halukmt/app-media-creator --skill amc-copy`). Given a job folder, it SHALL look at the screenshots,
follow the bundled copy rules and `claims.json`, write variants A (outcome-first) and B (mechanism-first) for every
language of the job with native phrasing, save `headlines.json`, and check it with its own script before handing over.

#### Scenario: Check script and tool agree
- **WHEN** `headlines.json` uses a forbidden claim or names an unknown screenshot
- **THEN** the skill's check exits with an error naming it, and the tool reports the job as invalid

### Requirement: Copy limits per layout
The brief SHALL give each slot its card layout and the recommended maximum headline and subline length for that layout;
the tool SHALL warn about longer texts per slot.

#### Scenario: Large-device layout
- **WHEN** a slot uses the layout with the large device
- **THEN** its limits in the brief are the shorter ones of that layout
