# Design

## Context

Core and API from #11, #12, #13. The UI had the shell (#4) and Export (#32) with SectionLayout, LocaleSelector and the
live-region pattern.

## Decisions

1. **Steps in SectionLayout** (`steps` prop): every asset section uses the same L2 flow.
2. **OptionGroup for every choice** (purpose, layout, background, frame, device, locales): one pattern; LocaleSelector
   is rebuilt on it. Background swatches use inline colours that come from the server (data, not UI styling); there is
   no colour picker.
3. **Editing language separate from the locale bar:** the bar picks what to generate; a single LocaleSelector picks the
   language to upload and edit (default: source language, follows the bar when it drops the choice).
4. **Autosave with flush:** edits are saved 600 ms after the last change, serialized; upload, generate and leaving the
   page flush pending edits first, so nothing is lost or overwritten by an older save.
5. **Previews inside the slots:** each SlotEditor shows its card preview, status badge and warnings next to its texts;
   one request at a time for the editing language and chosen device, refreshed after each save. Fallback languages
   show a preview grid of the source slots.
6. **Generate per language:** one request per language gives real progress; languages without screenshots are skipped
   on the server and cleaned up.
7. **Serving uploads** only by exact match with the listed uploads, with `nosniff` and `sandbox` CSP (security note #3).
8. **Windows:** `writeJsonAtomic` retries a rename that fails with EPERM / EBUSY while another request reads the file.

## Reuse map (component-architect)

| Need | Decision |
|---|---|
| Steps | NEW `StepsBar` (via SectionLayout) |
| Purpose / layout / background / frame / device / locales | NEW `OptionGroup`; `LocaleSelector` on top |
| Upload | NEW `FileField` + NEW `ProgressStatus` (also replaces inline spinners in App and Export) |
| Slot | NEW `SlotEditor` (media render prop, TextField with `lang`, OptionGroup overrides) |
| Preview card | NEW `PreviewCard` (fallback grid; later logo / video) |
| Shadow switch | NEW `ToggleField`; TargetCard uses it |
| "Comes later" | `RequiredBadge` with `label` |
| Empty state, alerts, busy button | existing `SectionEmptyState`, `StatusAlert`, `BusyButton` |

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| e2e | Parallel project writes on Windows failed with EPERM on rename | major | Retry in `writeJsonAtomic`; screenshots e2e runs after export | fixed |
| e2e | Long option labels overflowed at 375 px | major | Chips wrap (`whitespace-normal`, `max-w-full`) | fixed |
| code-review | Pending save dropped on unmount | major | Flush on unmount | fixed |
| code-review | Stale save after upload dropped a new screenshot | major | Flush before upload; serialized saves | fixed |
| code-review | Generate ignored pending edits | major | Flush before generate | fixed |
| code-review | Per-language generate no longer cleaned skipped languages | major | Server returns skipped languages and cleans them; only "no screenshots at all" is an error; test | fixed |
| code-review | Preview showed slots beyond the store maximum as OK | minor | `not-exported` warning; test | fixed |
| code-review | Load failure left a blank step | minor | Error alert with retry | fixed |
| code-review | Unreadable logo removed all background presets | minor | Palette errors only empty the palette | fixed |
| code-review | Stored background not in the offered list showed no selection | minor | Offered as "Current background" | fixed |
| code-review | Dead `defaults` line | minor | Removed | fixed |
| code-review | One preview request per slot repeats file I/O | minor | Kept for now; batch endpoint when needed | won't fix now |
| design-critic | Placeholder previews showed OK | major | Badge only with a result | fixed |
| design-critic | Preview step empty for frame-only | major | Step disabled for frame-only; frame options in the purpose step | fixed |
| design-critic | Preview far below the edited slot | major | Preview inside each slot | fixed |
| design-critic | Slot image detached from its card | major | `card-side` with bordered card, narrow figure | fixed |
| design-critic | Focus lost after remove | major | Focus moves to the next slot heading | fixed |
| design-critic | Autosave announced on every pause | major | Separate status region for move / remove; save state not announced | fixed |
| design-critic | "Phone screenshots" ambiguous | major | Store shown next to the device | fixed |
| design-critic | Slot heading level, small icons, step naming, hint wiring, upload success region, fallback action | minor | h4, SVG icons with visible disabled state, "Export" heading and "Open Export section", `aria-describedby`, mounted region, "Upload … screenshots" button | fixed |
| security-review | No findings: exact path match, Host check on GET, no CORS, validated colours, data-URL previews | — | — | — |
