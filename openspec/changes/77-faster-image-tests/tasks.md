## 1. Profile

- [x] 1.1 JSON report of a full run before and after each step (242 s → 190 s, worker count and sharp threads compared)

## 2. Changes

- [x] 2.1 One temp root for all test workspaces, documented in `docs/testing.md`
- [x] 2.2 `AMC_X264_PRESET` and `AMC_FFMPEG_THREADS` for encodes; tests use ultrafast and 2 threads
- [x] 2.3 sharp limited to one thread per worker in `tests/setup.ts`
- [x] 2.4 Heaviest video tests in their own files; one repeated generate run less in the iPad test

## 3. Final check

- [x] 3.1 `npm run build`, `check`, `check:all`, `npm test`, `npm run test:e2e`; `/code-review`; CHANGELOG
