# Design

## Decisions

1. **Schemas once, in zod.** The result schemas live in `src/core/jobs/schemas.ts`; every job folder gets their JSON
   Schema (`z.toJSONSchema`, input side) under `schemas/`, so the skill can check its output against the exact rules
   the tool applies.
2. **Results name slots by `input`**, the workspace path from the brief, not by position: reordering in the UI cannot
   assign a headline to the wrong screenshot, and stale results fail loudly.
3. **Validation is all or nothing per job.** Any error makes the job invalid and hides all results, because a
   partially valid AI answer is easy to misread. Length rules from the copy rules (§8) are warnings; the hard limit is
   the set's 200 characters. Forbidden claims are matched case-insensitively as substrings.
4. **Files read from a job** are regular files only (no links), at most 256 KB, at fixed names; store text names come
   from a whitelist; storyboard images must be images of the brief. Job ids match a fixed pattern, so no request can
   reach outside `jobs/`.
5. **ffmpeg** runs through `execFile` with an argument list (no shell), a 2-minute timeout and `FFMPEG_PATH`; a missing
   binary is a note in the brief, not an error. Tests fake it at the module boundary; one test uses the real ffmpeg
   when it is installed.
6. **Live updates:** `fs.watch` (recursive) on `jobs/`, debounced 250 ms per job id, one watcher shared by all
   server-sent-event streams and stopped when the last one closes. The UI follows the newest job, refetches on
   `open` (reconnect), and also loads the newest job on page open, so a result written while the page was closed shows.
7. **Apply** starts from each language's current set (its own, or the source language's for a fallback language):
   order, screenshots and style overrides stay as they are now; only the texts of the screenshots the result names
   change. It writes through `saveScreenshotSets` (same validation as the editor). `applied.json` stores a hash of
   `headlines.json`, so a later run into the same folder counts as a new result.
8. **UI** per the component-architect reuse map: `AiJobPanel` (own component; the page holds no markup),
   `CommandBox` (`mockup-code`, copy with visible "Copied", selection fallback), `HeadlineVariantsCard` (`card` +
   `list`, A and B stacked at 375 px, side by side from `sm`), `ConfirmDialog` before overwriting.
   - DaisyUI sets `width: max-content` on `.mockup-code pre` and `grid-auto-flow: column` / `grid-row-start: 1` on
     `.list-row`; both are overridden so long paths wrap and the variants stack on phones.

## Review log

- **/code-review:** 10 findings. Fixed: apply rebuilt sets from the brief, so screenshots the AI left out were dropped
  for good, fallback languages lost the source's style overrides and edits since the job were reverted → apply
  starts from the current effective set and only replaces texts (tests for left-out slots, reorder and overrides);
  `applied.json` marked rewritten results as applied → hash of `headlines.json`; the event stream closed after an
  invalid read → the newest job is followed while the page is open; a watcher error could crash the server → error
  handler; a failed refresh after a successful apply read as "could not be applied" → optimistic applied state, refresh
  separately; focus returned to "Apply variant A" → per-variant refs and the opening button; the applied message showed
  twice → one source (the job); `GET /jobs` read every job and the project per job → `?limit=1`, project read once.
- **security-review:** no findings (job ids anchored, result files lstat + size cap + whitelists, ffmpeg via execFile
  with an absolute input path, event stream behind `localOnly()` without CORS, AI text rendered as text only).
- **design-critic:** 7 findings. Fixed: double applied message; apply errors now right below the apply buttons;
  focus return; languages without headlines are named; the code box is no longer an extra tab stop (the command wraps);
  the copy fallback says "press Ctrl+C"; only the pressed apply button shows "Applying…".
