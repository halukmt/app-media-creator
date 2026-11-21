import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    // The fastest x264 preset and two encoder threads: the tests check sizes, durations and streams, not the
    // compression, and many encodes run at once (#77).
    env: { AMC_X264_PRESET: 'ultrafast', AMC_FFMPEG_THREADS: '2' },
    // Generator tests render many images and videos; in a full local run the heaviest image tests take up to about
    // 50 s, so 60 s keeps them green and still stops a test that really hangs (#72, #77). Video tests that encode
    // full store sizes set their own limit.
    testTimeout: 60_000,
  },
});
