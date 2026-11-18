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
| axe | `alert-soft` error text fails contrast (2.65:1) | serious | Solid alerts (`*-content` colours) | fixed |
| code-review | A finishing save overwrites edits typed during the request | major | Fields disabled while saving (`fieldset disabled`) | fixed |
| code-review | Project draft lost when visiting another section | major | Project page stays mounted (hidden) while other sections show; e2e test | fixed |
| code-review | Field errors stay after the field is fixed | minor | Any edit clears the last result | fixed |
| code-review | "All languages" gets disabled under keyboard focus | minor | Stays enabled; choosing it again is a no-op | fixed |
| code-review | Drawer stays open when the current section is tapped | minor | Links close the drawer on click | fixed |
| code-review | Invalid `project.json` shown as "server not running" | minor | Load error shows the server's `problems` list | fixed |
| code-review | Web types copied from core instead of `import type` | minor | Kept: a type import makes the web tsconfig check core files that need Node types | won't fix |
| code-review | Field error markup in three components | minor | New `FieldError` component (inventory) | fixed |
| code-review | Locale literals in catalogue test | minor | `allLocaleIds()` factory | fixed |
| code-review | Separate `saved` state duplicates the `project` prop | minor | Dirty check against `toForm(project)` | fixed |
| design-critic | Focus ring invisible on selected locale chips | critical | `outline-base-content` | fixed |
| design-critic | Drawer focus handling | major | Focus moves into the menu on open, back to the menu button on Escape / overlay; page `inert` while open | fixed |
| design-critic | Locale bar heavier than the task | major | Outline chips, selected = active fill + border + check mark; "All languages" on its own row | fixed |
| design-critic | Toggle on/off hard to tell apart | major | `toggle-success` | fixed |
| design-critic | Save button and unsaved badge off-screen on phones | major | Sticky save bar | fixed |
| design-critic | Device names 12 px | major | `text-sm` | fixed |
| design-critic | Locale bar on Logo although icons are text-free | major | Kept: share images per locale (#9) are generated in the Logo section | won't fix |
| design-critic | Sidebar footer cut off; menu text not centred; heading sizes; invisible dashed border; inventory alert class; weak only action | minor | `h-full overflow-y-auto`, `content-center`, h2 `text-xl` / h3 `text-base`, `border-base-300`, inventory updated, `btn-primary` | fixed |
| design-critic | Nested live regions; focus lost on save; failed save does not point to the field | minor | Mounted `role` wrappers, alerts without own role; `aria-disabled` button; focus first invalid field | fixed |
| security-review | No findings (static GET route behind `localOnly`, server messages rendered as text, hash checked against a fixed list) | — | — | — |
