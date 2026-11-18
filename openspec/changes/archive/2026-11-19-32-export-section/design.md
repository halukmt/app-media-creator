# Design

## Context

`GET /api/export/checklist` and `POST /api/export` exist since #5. The Export section rendered the generic
`SectionPage` (locale bar + empty state). The shared locale selection lives in `App` (#4).

## Decisions

1. **`ExportPage`** replaces `SectionPage` for `export`. Order: locale bar, Download (overall status, hint, button),
   then Checklist (one card per enabled store). The primary action comes before the evidence.
2. **`SectionLayout`** (new layout) holds heading and locale bar for every asset section, so the bar has one fixed
   place (L3) and is wired once; `SectionEmptyState` holds the section empty state for SectionPage and ExportPage.
3. **Checklist grouped per asset** (`groupBySpec`): one row per asset with its worst status, the required marker and
   one badge per language; per-language messages sit in a "Details" collapse; OK assets are folded. The 375 px page
   with 6 languages shrank from about 4,200 px to 2,400 px.
4. **Reloads keep the last checklist** on screen; an `AbortController` drops outdated responses; the download result
   is cleared when the selection changes; Download is `aria-disabled` while checking.
5. **Download** via `fetch` → Blob → temporary link, saved under the server's file name (`downloadFileName` keeps only
   the base name). The `x-export-status` header is compared with the shown status to warn when files changed during
   the build. *Trade-off:* the ZIP is held in memory once; fine for image exports, revisit when video exports exist.
6. **Confirmation** with the native `<dialog>` (`ConfirmDialog`): focus starts on Cancel; every way out (Cancel, Escape,
   backdrop, confirm) goes through the dialog's close event, which returns focus to the Download button.
7. **E2E ordering:** `project.spec` changes the shared settings; Playwright runs `export.spec` in a project that depends
   on it, and `export.spec` also resets the settings itself.

## Reuse map (component-architect)

| Need | Decision |
|---|---|
| Heading + locale bar | `SectionLayout` (new layout) with `PageHeader` + `LocaleSelector` |
| Overall status, problems, errors | `StatusAlert` in mounted live regions |
| Empty state | `SectionEmptyState` (new) wrapping `EmptyState` |
| Status badge ok/warning/error | NEW `StatusBadge` (solid badges, visible word) |
| Required marker | NEW `RequiredBadge` (design review: TargetCard and ChecklistCard shared the markup) |
| Card per store | NEW `ChecklistCard` (`card`, `list`, `collapse`) |
| Confirmation | NEW `ConfirmDialog` (`modal` on `<dialog>`) |
| Busy button | NEW `BusyButton`, also used by ProjectPage |

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| e2e | Dialog backdrop button also named "Cancel" | minor | Backdrop labelled "Close dialog" | fixed |
| code-review | Empty selection left the page loading forever | major | Fall back to the project languages | fixed |
| code-review | Download section unmounted on every reload; old download result stayed | major | Keep the last checklist while loading; clear the result on selection change | fixed |
| code-review | `disabled` prop on the button was dead code | minor | Now disables while checking | fixed |
| code-review | Focus return on Cancel ran while the page was inert | minor | Close event returns focus (`returnFocus`); e2e for Cancel and Escape | fixed |
| code-review | `request()` threw a SyntaxError on an empty success body | minor | Empty body becomes null again | fixed |
| code-review | ZIP held in memory as a Blob | minor | Kept for image exports (see decision 5); object URL kept for 60 s | won't fix now |
| code-review | export.spec depended on project.spec resetting the settings | minor | export.spec resets the settings in `beforeAll` | fixed |
| code-review | Message text used as React key | minor | Index keys | fixed |
| code-review | Problems list inside the live region | minor | Problems shown outside the live region | fixed |
| code-review | CHANGELOG line missing | minor | Added | fixed |
| design-critic | Primary action at the bottom of a long page | major | Download section first | fixed |
| design-critic | Rows per language repeat the asset | major | Grouped per asset with language badges; messages in a Details collapse | fixed |
| design-critic | `aria-busy` on the section holding the live region | minor | `aria-busy` on the cards grid only | fixed |
| design-critic | Report disappeared on every toggle | minor | Same fix as code-review | fixed |
| design-critic | Focus return relied on the browser | minor | Same fix as code-review | fixed |
| design-critic | Empty "Web and social" card | minor | "Nothing is required…" note | fixed |
| design-critic | Text column jumped after Error vs Warning badges | minor | Fixed-width badge column | fixed |
| design-critic | Duplicate "Required" markup | minor | `RequiredBadge` | fixed |
| design-critic | Inconsistent counting words | minor | "asset sets" / "assets" | fixed |
| security-review | Not run: no server, API or file-handling change; the client keeps only the base name of the download file name (unit-tested) | — | — | — |
