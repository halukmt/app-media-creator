import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Generator tests render many images. A test that takes 4 s alone took 20 s and more in a full local run, where
    // all workers render at once and an antivirus scanner reads every written PNG; the heaviest tests reach 30–45 s.
    // 60 s keeps such runs green and still stops a test that really hangs (#72).
    testTimeout: 60_000,
  },
});
