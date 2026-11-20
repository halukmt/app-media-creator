## ADDED Requirements

### Requirement: Video section
The Video section SHALL follow the steps Upload, Purpose, Options and Export. Upload SHALL take a screen recording per
language. Purpose SHALL offer App Store preview, device video and header and search loop with their rules (sizes and
lengths from the catalogue), and show the promo reel as coming later; a purpose whose store is off SHALL be disabled
with the reason. Options SHALL hold the trim and, per purpose, the text cards or the device video options, saved
automatically. Export SHALL make the videos for the selected languages with progress in a live region and show the
generated videos with a player, their size and their validation state.

#### Scenario: App Store preview with a text card
- **WHEN** a German recording is uploaded, the purpose is App Store preview, a German intro card text is typed and the
  previews are made
- **THEN** the text is still there after a reload, and the Export step shows the iPhone preview with a player labelled
  "App Store preview, iPhone, German" and the validation state OK

#### Scenario: Invalid trim
- **WHEN** "abc" is typed as trim start
- **THEN** the field shows "Enter seconds as a number from 0, e.g. 2.5." and the value is not saved

#### Scenario: Generated video in byte ranges
- **WHEN** a player asks for bytes 8–15 of a generated MP4
- **THEN** the server answers 206 with exactly those bytes
