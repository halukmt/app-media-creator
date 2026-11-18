Issue: #4

# Proposal

## Why

The tool has a working core (specs, workspace, export, logo generators) but no UI beyond a placeholder card. Every
later UI issue (#10 logo section, #14 screenshots section, #32 export section) needs the same frame: a sidebar with
the sections, a Project screen for the settings that drive every generator, and one shared locale selector.

## What Changes

- **App shell:** sidebar layout with the sections Project, Logo, Screenshots, Video, Store texts, Export. On small
  screens a top bar opens the sidebar; on large screens the sidebar stays open. The current section is part of the URL
  (`#/project`, `#/logo` …), so reload and the browser back button keep the section.
- **Project screen:** edits the workspace settings from #3: app name, targets (App Store, Google Play, web) with
  enabled switch and device models, source locale, selected locales, allowed and forbidden claims. Saves through
  `PUT /api/project` and shows the server's validation messages next to the form.
- **Shared locale selector:** one control with "All languages" plus one option per locale, used for multi-select
  (project locales, later batch generation) and for a single locale ("this language").
- **Locale bar:** sections that produce localized media show the selector above their content; the selection is
  shared between sections and limited to the project's locales.
- **Empty states:** Logo, Screenshots, Video, Store texts and Export explain what to upload and which of the enabled
  stores need it, until their own issues build the real section.
- **Catalogue endpoint:** `GET /api/catalogue` returns the 6 locales and the device models per target with names and
  required flags, so the UI never imports server code.
- UI strings in `src/web/i18n/en.ts`; all components listed in the inventory.

Acceptance criteria from the issue:
- DaisyUI drawer layout per `.claude/rules/components.md` (L1–L6), mobile first, axe clean.
- Project screen edits the settings from the workspace issue (targets, devices, locales, claims).
- Shared locale selector: single locale, multi-select, "All languages".
- Empty states explain what to upload and which stores need it.
- UI strings in `src/web/i18n/en.ts`; components listed in the inventory.
- Playwright screenshots at 375 / 768 / 1280 px.

Targets: not target-specific (the Project screen configures App Store, Google Play and web). Locales: all 6
(`de-DE`, `en-US`, `es-ES`, `it-IT`, `fr-FR`, `tr-TR`).

## Not in this change

- The real section UIs: logo (#10), screenshots (#14), export with ZIP download (#32), video, store texts.
- Upload controls, previews (L4) and the steps flow (L2) — they come with the first section that uses them.
- A UI language other than English; theme switching.

## Capabilities

### New Capabilities
- `app-shell`: navigation between sections, the Project screen, the shared locale selector and empty states.

### Modified Capabilities
- None. The catalogue endpoint is part of `app-shell`.

## Impact

- `src/web/` (new layouts, pages, components, i18n, API client, pure helpers); `src/server/` (catalogue route);
  `tests/unit/` (helpers, catalogue route); `tests/e2e/` (shell, project screen, screenshots per width).
