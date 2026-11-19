# Spec Delta

## ADDED Requirements

### Requirement: User bezel artwork is drawn once
The shadow of a user bezel SHALL be drawn as a separate layer that contains only the shadow; the bezel artwork SHALL
be drawn exactly once, so semi-transparent bezel pixels keep the opacity they have in the bezel file (plus the shadow
beneath them).

#### Scenario: Semi-transparent ring
- **WHEN** a user bezel whose ring is red at 50 % alpha is drawn with the default shadow
- **THEN** a pixel in the middle of the ring has an alpha above 128 and below 180 (drawn twice it would be about 200)
