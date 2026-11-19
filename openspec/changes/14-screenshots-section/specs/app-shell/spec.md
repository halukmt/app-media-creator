# Spec Delta

## ADDED Requirements

### Requirement: Screenshots section
The Screenshots section SHALL guide through the steps Upload, Purpose, Preview and edit, and Export. Later steps SHALL
be unavailable, with a reason, until a screenshot is uploaded. The user SHALL be able to upload screenshots for a chosen
language, choose store screenshots with headline or frame only (header / search asset and feature graphic shown as
coming later), edit headline, subline and the style per slot, reorder and remove slots by keyboard, see the rendered
card of every slot for a chosen device with its validation state, and generate the languages of the locale bar.

#### Scenario: Two languages to the ZIP
- **WHEN** a screenshot is uploaded for German and one for Turkish, the German headline is edited and the screenshots are generated
- **THEN** the ZIP downloaded in the Export section contains `apple/de-DE/iphone-6.3/01-start.png`, `apple/tr-TR/iphone-6.3/01-baslangic.png` and `google/de-DE/phone/01-start.png`

#### Scenario: Reorder by keyboard
- **WHEN** the button "Move screenshot 1 down" is pressed with the keyboard
- **THEN** "Moved to position 2 of 2." is announced and the headline stays with its screenshot

#### Scenario: Purposes that come later
- **WHEN** the Purpose step is shown
- **THEN** "Feature graphic" and the header / search asset cannot be chosen and are marked "Comes later"

#### Scenario: Narrow screen
- **WHEN** the Preview and edit step is shown 375 px wide
- **THEN** the page has no horizontal scrolling and no serious or critical accessibility violations
