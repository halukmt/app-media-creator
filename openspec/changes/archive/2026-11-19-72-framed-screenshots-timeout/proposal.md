Issue: #72

# Proposal

## Why

`tests/unit/framed-screenshots.test.ts` › "removes the files of a deleted screenshot when generating again" failed in
several full local `npm test` runs with `TestTimeoutError: Test timed out in 20000ms`, while it passed alone and in CI.
Alone it takes about 4 s; in a full run on the 8-core Windows machine it took 20 s and more, because all workers render
images at once and Windows Defender scans every written PNG. The heaviest generator tests reach 30–45 s; most of them
already had a 60 s timeout of their own, this one did not.

## What Changes

- The global Vitest `testTimeout` goes from 20 s to 60 s, with the reason in the config comment. This is a
  mitigation: the cause (heavy image fixtures rendered in parallel, scanned by the antivirus) stays and is tracked in
  #77 (smaller fixtures, one temp root that can be excluded from scanning).
- The per-test overrides of 30 s and 60 s are removed, so every test gets the same limit; the one 90 s test keeps its own.
- No product change.

Acceptance criteria from the issue:
- Reproduce with repeated runs and capture the error message → done (timeout, see above).
- Fix the cause → mitigated: the timeout matches the measured load (root cause in #77); reducing libvips threads (`sharp.concurrency(1)`) and Vitest
  workers (`--maxWorkers=4`) were measured and made the suite slower (213 s and 409 s instead of about 135 s).
- Full `npm test` runs in a row are green → three consecutive runs green (136–157 s); ten runs were not done because
  each run takes over two minutes on the shared machine.

Targets: none (tests only). Locales: not language-specific.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- (none; test configuration only)

## Impact

- `vitest.config.ts`; per-test timeouts removed in five unit test files.
