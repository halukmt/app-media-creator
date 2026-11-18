# Spec Delta

## ADDED Requirements

### Requirement: Batch registration is all or nothing
When several generated files are registered together and one of them cannot be written, the system SHALL leave every
previously registered file and the manifest unchanged and SHALL leave no temporary files behind.

#### Scenario: A file of the batch cannot be written
- **WHEN** a batch of two files is registered and the second target cannot be written
- **THEN** the registration fails, the first target still holds its previous content and the manifest is unchanged
