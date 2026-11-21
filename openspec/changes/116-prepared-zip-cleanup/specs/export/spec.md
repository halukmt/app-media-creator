## ADDED Requirements

### Requirement: Prepared ZIPs never pile up
The system SHALL build prepared download ZIPs in a waiting folder of the current server run below `exports/prepared/`.
The first fetch SHALL move the ZIP to `exports/`, also when several fetches of the same link arrive at once. When a
token expires, the system SHALL drop it on its own timer, without waiting for another request, and SHALL remove the
ZIP if it was never fetched. When the server starts, it SHALL remove the waiting folders of earlier runs that are
older than the token lifetime, and SHALL leave the folders of runs that may still be alive.

#### Scenario: Abandoned download
- **WHEN** a ZIP is prepared, never fetched, and no other request arrives
- **THEN** after the ten minutes the token is gone and the ZIP is removed

#### Scenario: Restart
- **WHEN** the server starts and `exports/prepared/` holds an old folder of an earlier run and a fresh one of another
  running instance
- **THEN** the old folder is removed, the fresh one and the ZIPs in `exports/` stay
