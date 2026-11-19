# Design

## Decisions

1. **Block edits during apply** (a ref checked in `updateSets`) instead of reconciling a queued document with the applied
   one: the apply takes about a second, and a merge of two versions of the same text has no right answer. The lock is
   released only after the reloaded sets are rendered (an effect), so no handler of an older render can save the old
   texts; if the reload fails, edits stay blocked until "Try again" loads the applied texts. Refused move and remove
   actions announce nothing.
2. **Fingerprint at validation:** an internal `inspectJob` hashes the exact text it parsed; `applyHeadlines` writes that
   value, so the record matches what was applied even if the file changes later. The hash is not part of the API.
3. **Stale responses:** every change of the shown job bumps a version; a fetched job is kept only if nothing changed the
   panel since the request (a newer job, the optimistic "applied" state, a newer fetch).
4. **store-texts:** `lstat` inside the guard (only ENOENT means absent; links count as not a folder); unreadable
   language folders are reported per folder with relative labels. The job list keeps working.
5. Finding 1 has no automated test: it needs an edit timed into the apply window; the guard is a one-line check.

## Review log

- **/code-review:** 9 findings on the first version of this fix. Fixed: lock released before the reloaded sets were
  rendered and also after a failed reload → effect-based release, kept locked on reload failure; refused edits still
  announced "removed" → only accepted actions announce; the hash travelled through the API → internal `inspectJob`;
  same-id stale fetches could undo "applied" → version counter; `existsSync` + `lstat` gap and absolute paths in
  messages → `lstat` with ENOENT, per-folder relative errors. Filed: concurrent writers (a second tab) can still save
  an older document → #85 (Backlog, P2/S, revision check in the save). Accepted: no automated test that rewrites
  `headlines.json` exactly between validation and the record (needs an injection point in the save); the record test
  checks the fingerprint of the applied text.
