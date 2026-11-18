# Spec Delta

## ADDED Requirements

### Requirement: Drawer dismissal on narrow screens
When the sections menu was opened from the top bar, closing it without choosing a section (Escape or a tap outside the
menu) SHALL return keyboard focus to the menu button. Growing the window to the wide layout while the menu is open
SHALL leave every control of the page usable.

#### Scenario: Escape returns focus
- **WHEN** the menu is open on a 375 px wide screen and the user presses Escape
- **THEN** the menu is hidden and the "Open sections menu" button has focus

#### Scenario: Window grows to the wide layout
- **WHEN** the menu is open on a 375 px wide screen and the window is resized to 1280 px
- **THEN** the App name field of the Project screen can be focused and edited
