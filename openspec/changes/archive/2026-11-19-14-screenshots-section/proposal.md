Issue: #14

# Proposal

## Why

Screenshot sets (#12), the card renderer (#11) and website screenshots (#13) exist as core and API. Users need the
Screenshots section to upload per language, choose what the screenshots are for, write headlines, see the result per
device and generate the files.

## What Changes

- **Screenshots section** with the L2 steps Upload → Purpose → Preview and edit → Export (step bar in the shared
  section layout, usable by Logo and Video later).
- **Upload:** pick the language, add PNG / JPEG / WebP files with progress and per-file errors.
- **Purpose:** store screenshots with headline, or frame only (website, with frame kind and shadow). Product page
  header / search asset and feature graphic are shown as "Comes later" (M4).
- **Preview and edit:** section style (layout, background from server presets and the logo palette — no colour
  picker); per language an ordered list of slots with headline, subline, move up / down, remove and a per-slot style
  override (layout, background, frame). Each slot shows its rendered card preview for the chosen device with a status
  badge and the renderer's warnings (Google Play: no frame by default, warning above 20 % text, not-exported slots
  beyond the store maximum). Languages without own screenshots show the source previews and a way to upload their own.
- **Export:** generate the languages of the locale bar (one request per language, with progress), then open the Export
  section.
- **Server:** `GET /api/inputs/file` (uploaded screenshots for thumbnails, `nosniff` + `sandbox` CSP), `POST
  /api/screenshots/preview`, `GET /api/screenshots/backgrounds`; per-slot overrides in the sets; card size per device
  in the catalogue; generation keeps cleaning languages without screenshots.
- **Components:** OptionGroup (LocaleSelector rebuilt on it), StepsBar, FileField, SlotEditor, PreviewCard,
  ProgressStatus, ToggleField (TargetCard uses it); RequiredBadge gets a label, TextField a `lang`.

Acceptance criteria from the issue:
- Purpose step: store screenshots with card, frame only; header / search and feature graphic link to M4.
- Layout, background and frame choice per slot; headline and subline editable per locale.
- Preview grid per locale and device with validation badges; Play preset defaults to "no frame" and warns at > 20 %.
- E2E test: upload → edit → export for two locales.

Targets: App Store, Google Play, web. Locales: all 6; upload and editing per language, generation for the locale bar.

## Not in this change

- Header / search assets and feature graphics (M4); AI headlines (M3); drag-and-drop reordering (buttons only).
- A batch preview endpoint (one request per slot for now).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `app-shell`: the Screenshots section.
- `screenshot-sets`: per-slot style overrides, previews, served uploads, background choices.

## Impact

- `src/web/` (page, components, layout, API client, strings, helpers); `src/server/{workspace,generate,catalogue}-routes.ts`;
  `src/core/generators/screenshot-cards.ts`, `src/core/workspace/{screenshot-sets,workspace}.ts`; tests; Playwright
  project order.
