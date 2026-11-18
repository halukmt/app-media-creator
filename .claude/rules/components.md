---
paths:
  - "src/web/**"
---

# Component rules

- **Before any change** in `src/web/components/`, `src/web/layouts/` or `src/web/pages/`: run the agent
  `component-architect` and load the skill `daisyui` (section 4 of `.github/copilot-instructions.md`).
- **Inventory:** `src/web/components/INVENTORY.md` is the binding list of all components with purpose,
  DaisyUI class, reason and rejected alternative. A new component is listed there first.
  `npm run check:inventory` fails when a file is missing there or a row points to a missing file.
- **Reuse order:** import an existing component; otherwise wrap one DaisyUI component once (`btn`, `card`,
  `drawer`, `menu`, `steps`, `fieldset`, `input`, `select`, `file-input`, `toggle`, `tabs`, `alert`, `badge`,
  `progress`, `modal`, `table`, `collapse`); only then build something new.
- One component per pattern. If two components share more than a frame, merge them and control the
  difference with props.
- Pages and layouts are composed only of components. No markup in a page that rebuilds a component.
- File names in PascalCase, `.tsx`, one exported component per file, typed `Props` interface at the top.
  `children` or named render props for content areas, no HTML strings as props.
- **Colours only through DaisyUI theme variables** (`bg-primary`, `text-base-content`, `bg-base-200` …).
  Never a hex value or a fixed Tailwind colour (`bg-blue-600`) in UI code. Exception: user-chosen
  background colours of generated media are data, not UI styling.
- UI text lives in `src/web/i18n/en.ts` (the UI is English; the UI language is separate from the 6 media locales).
- Semantic HTML first (`header`, `nav`, `main`, `section` with heading, `button` for actions, `a` for navigation).
  Visible focus (`focus-visible`), `aria-expanded`, `aria-current`, `aria-live` for progress and errors.
- Mobile first: design at 375 px, then `sm:`, `md:`, `lg:`. Tap targets at least 44 px.
- Every component is used by at least one page. Remove dead components.

## App layout (tool UI, not a marketing site)

- **L1 Shell:** DaisyUI `drawer lg:drawer-open` with a sidebar menu and the main area. Sidebar order:
  Project, Logo, Screenshots, Video, Store texts, Export. A `navbar` on small screens opens the drawer.
- **L2 Steps:** each asset section uses the same `steps` flow: Upload → Purpose / options → Preview & edit → Export.
- **L3 Locale bar:** every section that produces localized media shows the same locale selector
  (single locale, multi-select, "All languages") in a fixed place above the preview.
- **L4 Preview grid:** previews in a responsive grid of `card`s; each card shows asset name, size and
  validation state (`badge` success / warning / error).
- **L5 Feedback:** long operations show `progress` and an `aria-live` status line; errors as `alert` next to the cause.
- **L6 Empty states:** every section explains what to upload and which stores need it.
