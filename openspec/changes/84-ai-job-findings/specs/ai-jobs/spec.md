## ADDED Requirements

### Requirement: Applying is safe against concurrent edits and rewrites
While headlines are applied and the sets reloaded, the Screenshots section SHALL not take screenshot edits, so no
older document can overwrite the applied headlines. The applied record SHALL hold the fingerprint of the result text
that was validated and applied. A job refresh SHALL update the panel only when it belongs to the job the panel shows.

#### Scenario: Rewritten after applying
- **WHEN** a result is applied and then `headlines.json` is rewritten
- **THEN** the job reads as ready again, because the fingerprint differs from the applied one

### Requirement: Broken result folders are invalid results
A `store-texts` entry that is not a folder, or a folder that cannot be read, SHALL make the job invalid with an error;
it SHALL never make the job endpoint or the job list fail.

#### Scenario: store-texts written as a file
- **WHEN** the AI writes `store-texts` as a file
- **THEN** the job is invalid with the error that store-texts must be a folder, and the job list still loads
