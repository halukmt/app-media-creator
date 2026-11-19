# Design

## Decision

Move the save logic out of the page into a framework-free queue so the failure paths are unit-tested. The queue keeps
an internal chain that never stays rejected (later flushes still run) and returns the attempt's own promise, which
rejects on failure. The page maps a rejected flush to an error message and returns before uploading or generating.
Timer and unmount flushes ignore the rejection; the page already shows "Changes could not be saved".

## Review log

| Source | Finding | Severity | Decision | Status |
|---|---|---|---|---|
| code-review | A flush with nothing pending resolved although the save already running failed | major | `flush` returns the latest attempt when nothing new is pending; test | fixed |
