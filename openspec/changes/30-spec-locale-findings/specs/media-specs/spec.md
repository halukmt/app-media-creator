## ADDED Requirements

### Requirement: iPad app preview sizes per generation
The catalogue SHALL accept 1200×1600 and 900×1200 app previews for the iPad 12.9" (2nd generation) and only 900×1200
for the iPad 9.7", as separate entries.

#### Scenario: 12.9-inch preview at the larger size
- **WHEN** a 1200×1600 app preview is checked against the iPad 12.9" (2nd gen) entry
- **THEN** its dimensions are valid, while the same size is invalid for the iPad 9.7" entry
