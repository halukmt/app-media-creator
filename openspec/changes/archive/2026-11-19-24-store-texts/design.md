# Design

## Decisions

1. **A separate text catalogue** (`src/core/specs/texts.ts`) instead of `SpecEntry`: media entries describe pixels,
   formats and alpha; text fields need a length unit, paste order and multi-line flag. Same rules apply: one source,
   `verified` and a source URL per entry. `STORE_TEXT_FIELDS` (job contract) now comes from this catalogue.
2. **Limits are errors in the checklist, warnings in a job result.** A job result over a limit is still useful (the
   user shortens it after applying); the export checklist marks it as an error because the store rejects it.
   Texts are stored as typed; checks and the export trim them.
3. **Bytes for Apple keywords** (UTF-8, as App Store Connect counts them): Turkish and other accented letters take two
   bytes, so a character count would pass texts the store rejects.
4. **Advisory checks only where they are language-neutral:** keyword duplicates, spaces after commas, words repeated
   from name or subtitle, emoji, `#1` and ALL CAPS in the Play title. Words such as "best" or "free" differ per
   language; the copy rules and the project's forbidden claims cover them.
5. **Document with revision** (`store-texts.json`), saved one after another per workspace like the screenshot sets;
   the HTTP route requires a revision. The page saves with a debounce, flushes before an AI apply and reloads after
   it; a conflict reloads the current document and tells the user.
6. **Job task `store-texts`** reuses the job folder contract of #15 (`store-texts/<locale>/<field>.md`). Screenshots
   are optional for this task (they help the AI, they are not required). The applied marker stores a fingerprint of
   the validated store texts, like the headlines.
7. **Jobs per task:** `GET /api/jobs?task=copy&limit=1`, so a newer store texts job never hides the newest copy job.
8. **Export layout:** `<target>/store-texts/<store code>/NN-<field>.txt` keeps everything for one store under its
   folder; the folder name is the store's own locale code (`it`, `tr` for App Store Connect) because that is what the
   store and upload tools use. `NN` is the paste order of the store form. Files hold the trimmed text, UTF-8, no BOM.
9. **Humanizer:** the skill carries an adapted Light mode (pass 1 tells; from pass 2 only very long sentences),
   credited to ste80-humanizer and blader/humanizer (both MIT) in the reference file and `THIRD_PARTY_NOTICES.md`.
   Used on description, promotional text and what's new only, never on name, subtitle, title or keywords.
10. **No L2 steps in Store texts:** the section is one form (no upload, no rendered preview); the flow ends with the
    primary `Export →` link like the other sections. To be confirmed by Haluk (layout rule L2).
11. **A broken `store-texts.json` is an error, never an empty document:** reading it throws, so no save replaces the
    user's texts; the API answers 500 and the export lists it as a checklist problem. Single broken entries (not text,
    too long) are dropped one by one.

## Reuse map

From component-architect (before UI work):

- Frame and locale bar: `SectionLayout` with `localeBar`; no store enabled: `SectionEmptyState`; load error with retry
  and no language selected: `StatusAlert`.
- One language: **new `StoreTextsCard`** (`card`, one `fieldset` per enabled store, fields in paste order). Rejected:
  LocaleTextFields (wrong axis), `collapse` (hides errors), `tabs` (hides the other store), `table` (375 px).
- Field: **extend `TextField`** with `counter`, `messages`, `disabled` and the required marker; `FieldError` gets a
  warning `tone`. Rejected: a CountedTextField wrapper (same frame and describedby ids), DaisyUI `validator` (cannot
  count bytes or show server messages). No `maxLength`: over-limit drafts must be saved.
- Save line: **new `SaveStatus`**, replacing three inline copies (Screenshots ×2, Logo).
- AI job: **generalize `AiJobPanel`** (texts, result locales, actions and the preview as children); headline preview
  and store text preview share **`AiResultCard`** (renamed from HeadlineVariantsCard; long texts in a `collapse`).
- Not done: shared hooks for job following and revision autosave (follow-up issue).

## Review log

- `/code-review` (10 findings):
  - Fixed: a broken `store-texts.json` read as an empty document that the next save overwrote (decision 11); apply
    and per-task listing read the job folder twice / every other job (now `applyJob` and `briefTask` read only the
    brief's task); the check script reads the field list from the brief; one `MAX_STORE_TEXT` constant; store text
    files built once per store; dead strings and `latestCopyJob` removed; one `resultLocales` helper; LogoPage format.
  - Kept: the "Required" marker now shows on every required TextField (Project app name, environment folder); it sits
    outside the label, so names and tests are unchanged, and it is consistent with TargetCard.
- `design-critic` (13 findings):
  - Fixed: primary `Export →` link; save state and edit pause in a sticky bar below the fields; read-only fields look
    disabled; going over a limit is announced once (`aria-live`); textareas 3–5 rows growing with content
    (`field-sizing-content`); max width 3xl; over-limit AI texts marked in the preview; collapse summaries name their
    row for screen readers; no double over-limit text when the server error shows; TextField frame is a `div` (no
    unnamed nested group); loading state; Prepare disabled without a language; L2 deviation recorded (decision 10).
  - Not done: a status badge per language card (the export checklist gives the overview per language).
- `security-review`: no high-confidence findings (checked localOnly coverage of the new routes, path building from job
  ids, locales and fields, symlinks in job results, prototype keys in the document, ZIP entry names, XSS sinks).
