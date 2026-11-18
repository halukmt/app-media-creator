# Component inventory

Binding list of all UI components in `src/web/components/`. A new component is added here **before**
its file is created, with a one-line reason and the rejected alternative. `npm run check:inventory`
fails when a component file is missing here or a row points to a missing file.

Layouts (`src/web/layouts/`) and pages (`src/web/pages/`) are not listed; they are composed of these components.

| File | Purpose | DaisyUI | Reason | Rejected alternative |
|---|---|---|---|---|
| `EmptyState.tsx` | L6 empty state: what to upload and which stores need it (badges), optional actions slot | `card card-dash`, `badge` | Five sections need the same "nothing here yet" block; one component keeps wording and layout identical | `alert` (reports an event, not a missing input); `hero` (marketing pattern, too large in a tool UI) |
| `LocaleSelector.tsx` | Shared locale selector (L3): single locale, multi-select, "All languages" | `fieldset`, `btn` on checkbox / radio inputs | L3 requires exactly one locale control everywhere, including the source locale | `<select multiple>` (poor on touch, no "All"); `filter` (hides the other options); `join` (does not wrap at 375 px); a separate single-locale select (a second selector) |
| `PageHeader.tsx` | Page `h1` + description, focus target after navigation | none (Tailwind) | Every page needs the same heading block and focus handling | A title prop on AppShell (the shell stays unaware of sections; the page owns its heading) |
| `StatusAlert.tsx` | Feedback line for success, info, warning and error (L5) | `alert alert-soft` + colour | One place for role and aria-live wiring | `toast` (disappears; errors must stay next to their cause) |
| `TargetCard.tsx` | One store target: enabled switch + device model checkboxes with required markers | `card card-border`, `toggle`, `checkbox`, `badge`, `collapse` | Three identical target blocks on the Project screen | Generic Toggle + CheckboxGroup components (one consumer so far); `table` (unusable at 375 px) |
| `TextField.tsx` | Labelled text input or textarea (`multiline`) with hint and error | `fieldset`, `input`, `textarea`, `label` | One frame for label, hint, error and aria wiring | Separate TextListField (same frame, merge rule); `floating-label` (no room for hint and error) |
