# Design

## Decision

A version counter in the queue: `schedule` increments it and tags the pending document. On failure the document is
restored only if `pending` is empty and its version is still the latest. An empty pending slot alone is not proof,
because the newer version may already be queued or saved.

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | No findings | — | — | — |
