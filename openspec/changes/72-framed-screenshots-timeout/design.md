# Design

## Decisions

1. **Raise the global timeout to 60 s** instead of one more per-test override: the same load hits every generator
   test, and 60 s is what the heaviest tests already use. A test that really hangs still fails within a minute.
   - *Alternative:* `sharp.concurrency(1)` in a setup file. Measured: 213 s and three timeouts (each worker then
     renders single-threaded).
   - *Alternative:* fewer Vitest workers (`maxWorkers: 4`). Measured: 409 s and eight timeouts under the same load.
   - *Alternative:* smaller screenshots in the test. Rejected: the test is not unusually heavy (4 s alone); the load
     comes from the full run and the antivirus scanner, so other tests would be next.
2. **One limit for all tests.** The per-test `30_000` and `60_000` overrides are removed: the 30 s ones would undercut
   the new default, the 60 s ones are dead config. Only the 90 s test keeps its override.

## Review log

- **/code-review:** 6 findings. Fixed: two 30 s overrides undercut the new default and 21 overrides of 60 s were dead
  config → removed; the proposal claimed the cause was fixed → stated as mitigation, root cause in #77 (Backlog,
  P2/S); the CHANGELOG line sat in the middle of the Fixed list → moved to its end. Accepted: 60 s also loosens the limit
  for fast core tests (a hanging test still fails within a minute; #77 is the real fix); three consecutive green runs
  instead of ten (each run takes over two minutes on the shared machine).
- Local runs: the e2e suite on the overloaded machine (another project's Playwright server and tsc, Defender) failed
  three unrelated tests waiting 5 s for a heading with the default workers; with `--workers=2` all 57 passed.
