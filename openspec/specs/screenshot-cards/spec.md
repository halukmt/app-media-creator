# screenshot-cards Specification

## Purpose
Renders store screenshot cards (background, headline, subline and the app screenshot in a device frame) as opaque PNGs
at the exact size of a screenshot spec, identical on every machine.

## Requirements

### Requirement: Card output
The system SHALL render a card as a PNG without alpha channel of exactly the requested width and height. For a
screenshot spec the size SHALL be the spec's first fixed size or, for a range rule, its default size; the result SHALL
pass the validation of that spec.

#### Scenario: iPhone 6.3" card
- **WHEN** a card is rendered for `apple.screenshot.iphone-6.3`
- **THEN** the PNG is 1179×2556, has no alpha channel and passes the validation of `apple.screenshot.iphone-6.3`

#### Scenario: Google Play phone card
- **WHEN** a card is rendered for `google.screenshot.phone`
- **THEN** the PNG is 1080×1920 and passes the validation of `google.screenshot.phone`

### Requirement: Layouts
The system SHALL offer the layouts `text-top` (headline above a fully visible device), `text-top-large` (headline above
a larger device that runs off the bottom edge) and `text-bottom` (device on top, headline below).

#### Scenario: Golden images
- **WHEN** each layout is rendered at 295×640 with the German and the Turkish sample texts, a gradient background, the iPhone frame and the sample screenshot
- **THEN** each image matches its golden image in `tests/golden/` within a small anti-aliasing tolerance

### Requirement: Text fitting
The system SHALL break headline and subline into balanced lines inside the layout's text box and shrink both together
down to half of the start size until they fit. A word wider than the line at the smallest size SHALL be hyphenated.
The result SHALL carry a warning when the text overflows the box, when a word was hyphenated, and when a character
cannot be drawn.

#### Scenario: Turkish characters
- **WHEN** a card is rendered with the headline "İstanbul’da şampiyonluğa giden yol"
- **THEN** no character is reported as missing

#### Scenario: Text too long
- **WHEN** a card is rendered with a headline of twelve repetitions of a 48-letter German compound word and a Chinese character
- **THEN** the warnings include text overflow, a hyphenated word and missing characters

### Requirement: Backgrounds
The system SHALL offer solid and gradient background presets and derive one solid background per logo palette colour
plus a gradient of the first two. The text colour SHALL be dark on light backgrounds and white on dark ones, judged by
the lower contrast of both gradient ends.

#### Scenario: Text colour
- **WHEN** the background is the solid colour `#f1f1f1`
- **THEN** the text is drawn in `#0a0a0a`

### Requirement: Device frames
The system SHALL draw generic, neutral device frames for iPhone (Dynamic Island), iPhone with home button, iPhone Duo,
iPad, Android phone and Android tablet, and support no frame. When `frames/user/<kind>.png` and `<kind>.json` exist,
the user's bezel SHALL be drawn instead, with the screenshot placed in the screen rectangle given in the JSON.

#### Scenario: User bezel
- **WHEN** `frames/user/iphone.png` and `iphone.json` exist and a card with the iPhone frame is rendered
- **THEN** the card shows the user's bezel instead of the generic frame

### Requirement: Card defaults per store
The defaults of a card SHALL come from its screenshot spec: no device frame where the store discourages frames
(Google Play), otherwise the matching generic frame, and a warning when the text covers more of the image than the
spec's overlay text limit (20 % for Google Play).

#### Scenario: Google Play defaults
- **WHEN** the card defaults for `google.screenshot.phone` are requested
- **THEN** they are 1080×1920, no frame and a text limit of 20 %
