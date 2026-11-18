# Spec Delta

## ADDED Requirements

### Requirement: Registered paths belong to one asset
The system SHALL reject registering a file at a path that is already registered for a different asset, so assets that
share a folder cannot overwrite each other.

#### Scenario: Same path for two assets
- **WHEN** a file is registered at a path that already belongs to another asset
- **THEN** the registration is rejected and the existing file stays unchanged
