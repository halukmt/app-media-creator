## ADDED Requirements

### Requirement: The UI download streams to disk
The system SHALL let the UI download a ZIP in two steps: preparing it (`POST /api/export/prepare`) SHALL build the ZIP
and answer with its file name, checklist status and a random token; opening `GET /api/export/download` with that
token SHALL stream the ZIP as an attachment. A token SHALL stay valid for 10 minutes (so a download manager can retry)
and SHALL then be dropped; a ZIP that was never fetched SHALL then be removed. When the requester of an export is
gone, building the ZIP SHALL stop and leave no partial file.

#### Scenario: Prepared download
- **WHEN** the UI prepares the export for `de-DE` and opens the download URL with the token
- **THEN** the browser receives the ZIP as an attachment under the file name the prepare step named

#### Scenario: Retry and expiry
- **WHEN** the same token is used again within 10 minutes
- **THEN** the ZIP is served again
- **WHEN** 10 minutes have passed
- **THEN** the token is unknown (404) and a ZIP that was never fetched is removed

#### Scenario: Aborted export
- **WHEN** the request is aborted while the ZIP is being built
- **THEN** the build stops and no partial ZIP is left in the exports folder
