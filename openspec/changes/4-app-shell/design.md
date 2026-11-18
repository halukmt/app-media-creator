# Design

## Context

`src/web/` held a placeholder card; there were no components, layouts or pages. The server offers `GET/PUT
/api/project` (only with a workspace) and returns validation errors as `"<path>: <message>"` strings. The device
options and locales live in `src/core/`, which depends on Node modules and must not be bundled into the UI.

## Goals / Non-Goals

**Goals:**
- One shell and one set of components that #10, #14 and #32 extend instead of rebuilding.
- All selection and parsing logic in pure functions (`src/web/lib/`), unit-tested in Node.

**Non-Goals:**
- Real section UIs, uploads, previews (L4), the steps flow (L2).
- A warning before leaving a page with unsaved changes (the form shows an "Unsaved changes" badge instead;
  sections other than Project hold no edits yet).

## Decisions

1. **Hash routing** (`#/project`, `#/logo` …) without a router library. The server already falls back to
   `index.html`; a hash keeps reload, bookmarks and back/forward working with 20 lines of code.
   *Alternative:* History API paths. Rejected: needs server-side awareness of UI routes for nothing gained locally.
2. **`GET /api/catalogue`** is mounted outside the workspace guard: locales (id, name, native name) and device models
   per target (id, name, required, condition). The UI mirrors the response types in `src/web/api.ts`.
3. **One `LocaleSelector`** for all three uses: project locales (multi + "All languages"), source locale (single,
   options = selected locales) and the locale bar of localized sections (multi, options = project locales). Selection
   rules in `lib/locale-selection.ts`: never empty in multi mode; restricted to offered locales.
4. **Shared section selection** lives in `App`, so the locale bar keeps its selection across sections; it is limited
   to the project locales whenever they change (`selectionForProject`).
5. **Field errors next to their cause** (L5): `lib/errors.ts` groups server messages by path prefix (`name`,
   `locales`/`sourceLocale`, `targets.<t>`, `claims.allowed`, `claims.forbidden`); leftovers go to one alert.
6. **Claims** stay raw textarea strings in form state and are parsed on save (`linesToList`), so typing Enter works.
7. **Drawer toggle** is a real `button` with `aria-expanded` bound to React state that drives the hidden
   `drawer-toggle` checkbox; the checkbox is `aria-hidden` and not focusable. The drawer closes on navigation and Escape.
8. **Device lists:** each target shows required and initially selected devices; the others sit in a "More devices"
   `collapse`, so the 19 Apple sizes do not fill the 375 px screen.
9. **Empty states** contain no store sizes (sizes live only in `src/core/specs/`); they name what to upload and the
   enabled targets that need the section.

## Reuse map (component-architect)

| Need | Decision | DaisyUI |
|---|---|---|
| Shell, sidebar, mobile bar | `layouts/AppShell.tsx` | `drawer lg:drawer-open`, `navbar`, `menu`, `menu-active` |
| Page heading | NEW `PageHeader` | none |
| Locales: project (multi + All), source (single), section bar | NEW `LocaleSelector` (one component) | `fieldset`, `btn` on checkbox/radio |
| App name, claims | NEW `TextField` with `multiline` | `fieldset`, `input`, `textarea`, `label` |
| Target enable + devices | NEW `TargetCard` | `card card-border`, `toggle`, `checkbox`, `badge`, `collapse` |
| Save result, load error, leftover errors | NEW `StatusAlert` | `alert alert-soft` |
| Section empty states | NEW `EmptyState` | `card card-dash`, `badge` |
| Save button, store badges | DaisyUI directly (`btn`, `badge`), no wrapper | `btn`, `badge` |
| Select field | Dropped: the source locale uses `LocaleSelector` single mode | — |

Accessibility notes taken over: skip link, focus on the page `h1` after navigation, `document.title` per section,
`aria-current="page"` on the menu link, tap targets ≥ 44 px (`min-h-11`, whole label rows), one `h1` per page, `h2` for
page sections, `h3` for target cards, errors via `aria-describedby` / `aria-invalid`, live regions mounted before use.

## Risks / Trade-offs

- [Edits are lost when navigating away from Project before saving] → visible "Unsaved changes" badge; a prompt can
  come later if users ask.
- [Locale bar on sections without previews looks empty] → kept for a stable L3 position; revisit with #10.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
