# Design

## Decisions

1. **Skill location:** `skills/amc-copy/SKILL.md` at the repo root, the layout `npx skills add <repo> --skill <name>`
   expects (as `skills/daisyui/SKILL.md` in the daisyui repo). The folder is already in the npm `files` list.
2. **Self-contained rules:** the copy rules live in the skill's `references/`, rewritten generically from the research
   file, because users install only the skill folder.
3. **Check script without dependencies** (`node check.mjs <job>`): the skill can run it from any project; it mirrors
   the tool's hard rules (format, known screenshots, languages, forbidden claims) and adds advisory warnings
   (per-slot length, exclamation marks, missing slots). The tool still validates on read; the test makes both agree.
4. **Limits per layout** are copy guidelines derived from each layout's start font size, not store sizes, so they live
   in `src/core/jobs` (`COPY_LIMITS`) and travel in the brief; older briefs fall back to the text-top limits.
5. **Variants differ in angle, not facts**; the skill never applies results and never reorders slots (it may suggest a
   better order in its reply).
6. Not tested automatically: installing through `npx skills add` (network) and the model's writing quality; the
   structure, the shipped files and the check are tested.

## Review log

- `/code-review` (10 findings), all fixed:
  - check script: enforces the 10-slot maximum; measures lengths after trimming, as the tool stores them; reads
    forbidden claims also from the current `project.json` and warns when `claims.json` is missing or invalid; reports
    a result that is not a JSON object (e.g. `null`) instead of crashing.
  - Tool warnings name the slot (`de-DE slot 2 A`), like the script.
  - text-top-large subline limit 40 instead of 36: only its headline starts larger.
  - `limitsFor(slot)` resolves own limits → layout limits → text-top limits; brief types are optional when read back.
  - Tests for per-layout warnings in script and tool, project claims added after the job, the slot maximum and `null`.
  - README shows the command with the full path, as the UI prints it.
