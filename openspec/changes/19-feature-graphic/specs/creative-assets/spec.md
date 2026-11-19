## ADDED Requirements

### Requirement: Feature graphic and in-app event images
The generator SHALL offer a second group of store artwork for every selected locale with screenshots: the Google Play
feature graphic (1024×500, PNG without alpha) with the locale's phrase, and the App Store in-app event card
(3840×2160) and details image (2160×3840) without any text. Key art SHALL sit in a centred key area. Only images of
enabled stores SHALL be made; with neither store enabled, generation SHALL fail with a message.

#### Scenario: German and Turkish
- **WHEN** a project with German and Turkish (German screenshots only) generates the feature group
- **THEN** six valid images are written, the event images of both languages are identical and the feature graphics differ

#### Scenario: Only the App Store enabled
- **WHEN** Google Play is disabled
- **THEN** only the event card and details image are made

#### Scenario: Preview of the feature group
- **WHEN** the user picks "Feature graphic and in-app event images" in the Screenshots section and opens the preview
- **THEN** three previews show with the key area named in their size line, and the phrases of the header purpose are reused
