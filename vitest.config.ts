import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    // Generator tests render many images; under parallel load they need more than the default 5 s.
    testTimeout: 20_000,
  },
});
