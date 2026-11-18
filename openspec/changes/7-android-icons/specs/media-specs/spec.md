# Spec Delta

## ADDED Requirements

### Requirement: Android launcher resources in one folder
The catalogue SHALL place the adaptive icon layers, the legacy launcher icon and the adaptive icon XML document
(`ic_launcher.xml`, format XML) in one shared folder for Android resources.

#### Scenario: Adaptive icon XML entry
- **WHEN** the entry for the adaptive icon XML is looked up
- **THEN** it is a document of format XML in the Android resources folder
