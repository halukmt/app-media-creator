## ADDED Requirements

### Requirement: Store text jobs
A job with task `store-texts` SHALL brief the AI with the fields of the enabled stores and their limits, the current
texts per language, and the screenshots with their headlines; screenshots are optional for this task. Its command is
`/amc-store-texts "<job folder>"`. The tool SHALL check the results against the store text catalogue (limit
violations are warnings, forbidden claims errors) and SHALL list jobs per task, so each section finds its newest job.

#### Scenario: Newest job per section
- **WHEN** a store texts job is newer than the newest copy job
- **THEN** the Screenshots section still shows the copy job and the Store texts section the store texts job

### Requirement: Applying store texts
Applying a ready store texts job SHALL merge the fields it wrote into the store texts document, keep every other text,
retry on a conflicting save, and mark the job applied for exactly that result.

#### Scenario: Partial result
- **WHEN** a job wrote only the German App Store description and the document has a German subtitle
- **THEN** after applying the description is the job's text and the subtitle is unchanged

### Requirement: The amc-store-texts skill
The package SHALL ship the skill `amc-store-texts` with its workflow, the store text rules (ASO keywords per language,
not translated 1:1), a light humanizer pass for long texts (adapted from ste80-humanizer, MIT, credited in
`THIRD_PARTY_NOTICES.md`) and a dependency-free check script that agrees with the tool.

#### Scenario: Check script and tool agree
- **WHEN** a result uses a forbidden claim or a field that does not exist
- **THEN** the check exits with an error naming it, and the tool reports the job as invalid
