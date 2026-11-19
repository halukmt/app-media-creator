# Spec Delta

## ADDED Requirements

### Requirement: User bezel shadow stays outside the screen
When a user bezel is drawn with a shadow, the shadow SHALL be drawn beneath the screenshot, so the screenshot inside
the bezel's screen opening keeps its own colours up to the opening's edge.

#### Scenario: White screenshot in a dark bezel
- **WHEN** a white screenshot is framed in a dark user bezel with a transparent screen opening and the default shadow
- **THEN** the screenshot pixel two pixels inside the left edge of the opening is still white (every channel at least 250), and the area below the device shows a partly transparent shadow
