# Design

## Decisions

1. **Revision counter in the document**, not a hash or an ETag header: it travels with the JSON the page already sends
   and receives, and `readScreenshotSets` returns it with the sets. Files from before have revision 0.
2. **Optimistic check inside a serialized save:** the core reads the stored sets through the same lenient reader as
   GET (`readStoredSets`), compares the revision and writes the next one in one queued step per workspace, so two saves
   based on the same revision cannot both pass, and a partly broken file cannot cause endless conflicts.
   `known` becomes the stored known uploads plus what the saving page knew and listed, not "all uploads": an upload
   the page never saw is still appended on the next read (uploads do not change the revision).
3. **Required at the HTTP edge, optional in the core:** the UI and other clients must name a revision (400 without
   one). Core callers that read and immediately save (the AI apply) pass the revision they read; tests that build sets
   by hand may leave it out and save unconditionally.
4. **Client stamping:** the page's own edits follow each other, so the save queue sends each document with the
   revision of the last successful save or load (`knownRevision`). A 409 means another writer: the queued edit is
   discarded (never retried, it is based on stale data), the sets are reloaded and a warning explains it; callers
   (upload, apply) continue, nothing waits any more. A reload whose revision is older than the known one does not
   replace the sets; one with a newer revision discards an edit still waiting, so a stale edit can never be sent with
   a fresh revision. The AI apply retries up to three times when a page saved between its read and its save.
5. **The edit lock around AI apply stays** (#84–#89): it still avoids a refused edit right after applying. With the
   revision check, a missed case no longer loses data; it ends in a conflict message instead.

## Review log

- **/code-review:** 10 findings. Fixed: a stale edit queued during a conflict reload could be sent with the new
  revision → a reload with a newer revision discards waiting edits; the stored revision came from a second, raw read
  (endless conflicts for a partly invalid file) → one lenient reader for GET and save; `known` = all uploads let a
  stale tab erase a new upload → known uploads of the page plus stored (test); a conflict made upload or apply show "your
  changes are still here" → the conflict is handled in `flushSave` and callers continue; the AI apply turned a
  concurrent save into a misleading error → up to three retries; a reload older than an own save could roll the known
  revision back → ignored; a global save queue → one per workspace; `discard()` kept the rejected promise as `last` →
  reset. Accepted: the 409 body's `current` is not used by the page (it reloads uploads too; other clients can use it).
- **security-review:** no findings (revision must be a whole number ≥ 0 and the stored value is the server's; 409 is
  behind `localOnly()` without CORS; no prototype keys survive validation).
