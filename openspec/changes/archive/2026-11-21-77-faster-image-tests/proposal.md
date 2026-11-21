Issue: #77

## Why

A full local `npm test` took 242 s on the 8-core dev machine, the heaviest tests 80–118 s, so a busier machine could
push them over their limits (#72 only raised the timeout).

## What Changes

- All unit test workspaces live under one temp root (`tests/factories/temp.ts`, `AMC_TEST_TMP`), documented in
  `docs/testing.md` with the antivirus exclusion.
- Video encodes read two optional settings: `AMC_X264_PRESET` (default `veryfast`) and `AMC_FFMPEG_THREADS` (default
  all cores). The tests use `ultrafast` and 2 threads; the seamless-loop test keeps `veryfast`.
- `tests/setup.ts` limits sharp to one libvips thread per Vitest worker.
- The two heaviest video tests run in files of their own; the iPad preview test drops a repeated generate run.

Measured (full run, same machine): 242 s → about 190 s; the heaviest test 118 s → about 85 s. The 90 s target of the
issue is not reached: the rest is real rendering of store-size images and videos, spread over many tests. A follow-up
issue covers removing repeated renders across tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None (test speed and two optional encoder settings; no requirement changes).

## Impact

- `src/core/video/tools.ts`, `preview.ts`, `compose.ts`; `vitest.config.ts`, `tests/setup.ts`, `tests/factories/*`,
  several test files; `docs/testing.md`, `README.md`, `.env.example`, CHANGELOG.
