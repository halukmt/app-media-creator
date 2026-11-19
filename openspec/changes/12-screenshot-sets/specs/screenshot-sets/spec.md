# Spec Delta

## Purpose

Ordered screenshot sets per language with their texts, and the generation of store screenshot cards for the device
matrix in one, several or all languages.

## ADDED Requirements

### Requirement: Screenshot set per language
The system SHALL keep, per language, an ordered list of at most 10 entries, each an uploaded screenshot with a headline
and a subline (up to 200 characters each), plus one card style (layout and background) for the project. New uploads
of a language SHALL be appended to its set unless the user already removed them from it; entries whose screenshot was
deleted SHALL be dropped without losing the other entries, texts or the style. Saving SHALL reject
unknown screenshots, a screenshot listed twice, more than 10 entries, unsupported languages and an invalid style.

#### Scenario: Uploads in order
- **WHEN** `start.png` and then `teams.png` are uploaded for German
- **THEN** the German set lists `start.png` first and `teams.png` second

#### Scenario: Deleted upload
- **WHEN** the German set has a (Erste) and b (Zweite) with the layout text-bottom, and a is deleted
- **THEN** the set reads b with "Zweite" and the layout is still text-bottom

#### Scenario: Removed from the set
- **WHEN** the German set is saved with a only although b was uploaded, and then c is uploaded
- **THEN** the set reads a, c

#### Scenario: Reordering keeps texts
- **WHEN** the German set "a (Erste), b (Zweite)" is saved in the order b, a
- **THEN** the set reads b with "Zweite" first and a with "Erste" second

#### Scenario: Invalid set
- **WHEN** a set lists a screenshot twice, a screenshot that was never uploaded, or the language `pt-BR`
- **THEN** saving is rejected with one message per problem

### Requirement: Fallback to the source language
A language without an own set SHALL use the source language's set. Cards made from a screenshot of another language
SHALL be marked as fallback input, which the export checklist reports as a warning.

#### Scenario: Turkish without screenshots
- **WHEN** only German (the source language) has screenshots and cards are generated for German and Turkish
- **THEN** the Turkish cards are marked as fallback input and the checklist says they were made from the de-DE input

### Requirement: Card generation for the device matrix
The system SHALL render, for each selected language, each device the project picked from the device matrix of an
enabled store, and each entry of the language's set up to the device's catalogue maximum, one card at the device's size
into `<target>/<locale>/<device>/NN-<name>.png`. Everything SHALL be rendered and validated before anything is written; then each selected language SHALL replace its
earlier cards of all matrix devices. A set below a device's catalogue minimum SHALL produce a warning. The run SHALL be
rejected when no device is picked or no language has screenshots.

#### Scenario: Two languages, two devices
- **WHEN** German has `start.png`, the project picks iPhone 6.3" and the Play phone, and cards are generated for all languages (German, Turkish)
- **THEN** `apple/de-DE/iphone-6.3/01-start.png`, `apple/tr-TR/iphone-6.3/01-start.png`, `google/de-DE/phone/01-start.png` and `google/tr-TR/phone/01-start.png` are written

#### Scenario: Unpicked device
- **WHEN** cards were generated for iPhone 6.3", the project now picks iPhone 6.9" instead, and cards are generated again
- **THEN** only the iPhone 6.9" cards remain

#### Scenario: One language
- **WHEN** cards are generated for `tr-TR` only
- **THEN** only Turkish cards are written

#### Scenario: Google Play maximum
- **WHEN** German has 9 screenshots and only the Play phone is picked
- **THEN** 8 cards are written
