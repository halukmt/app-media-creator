# Design

## Decisions

1. **Change only the default.** The schema defaults `environments` to `[]` and `defaultProject()` lists none. No migration: a project file that lists `preview` was saved by the user (or by the tool
   since #34) and is kept; removing it is one click on the Project screen.
   - *Alternative:* drop a stored `preview` that equals the old default. Rejected: the tool cannot tell a deliberate
     choice from the old default, and silently deleting icon sets on the next generation would surprise users.
2. **No UI change.** The Project screen already shows the hint and the Add button for an empty list, and the Logo
   section hides the "Icon set" filter when no environment has files; the e2e tests now start from the empty state.

## Review log

- **/code-review:** 7 findings.
  - Fixed: no API test returned variant entries any more → web-icons test with a saved `preview`; the Logo section's
    missing filter without environments was untested → e2e; checklist and ZIP of a project without environments were
    untested → unit test; helper returning `[]` → schema `.default([])`; stale schema comment; the MODIFIED
    requirement left out the reserved language codes → added.
  - Accepted: project files from before #34 (no `environments` field) that generated preview icons since #34 now
    read as having none, so those icons are left out of the ZIP (the checklist names them) and replaced on the next
    generation. The tool is unreleased (0.0.0) and this is the default Haluk chose; removing the files is one click away from what he wants anyway.
