// conventions: RULE-TESTING-3301
import path from 'node:path';
import { describe, expect, test, vi } from 'vitest';
import { readManifest } from '../../src/core/export/index.js';
import { generateLoopVideos } from '../../src/core/generators/video-assets.js';
import { getSpec, validateMedia } from '../../src/core/specs/index.js';
import { probeVideo } from '../../src/core/video/index.js';
import { frameAt, hasFfmpeg, meanDifference, recordingBytes, videoWorkspace } from '../factories/video.js';

const FFMPEG = hasFfmpeg();

// A file of its own: the 4K loop render is the longest test and runs in parallel to the others (#77).
// The failure cases of loops live in video-assets.test.ts.
describe.skipIf(!FFMPEG)('Header and search loops are rendered with ffmpeg', () => {
  test('writes seamless, muted header and search loops with the Turkish phrase from the German recording', async () => {
    const workspace = await videoWorkspace(recordingBytes({ seconds: 8, audio: true }));
    // The seam check compares the first frame (a keyframe) with the last one: it needs the real preset, not the
    // ultrafast one of the other tests, whose keyframes differ more from the frames between them (#77).
    vi.stubEnv('AMC_X264_PRESET', 'veryfast');
    // One language keeps the 4K render short; German is covered by the device video test above.
    const result = await generateLoopVideos(workspace, { locales: 'tr-TR' }).finally(() => vi.unstubAllEnvs());
    expect(result.entries.map((e) => e.path).sort()).toEqual(['apple/tr-TR/creative-header-video/01-header.mp4', 'apple/tr-TR/creative-search-video/01-search.mp4']);
    expect(result.entries.every((e) => e.fallbackInput)).toBe(true);
    const header = path.join(workspace.outputDir, 'apple/tr-TR/creative-header-video/01-header.mp4');
    const props = await probeVideo(header);
    expect(validateMedia(getSpec('apple.creative.header-video'), props)).toEqual([]);
    expect(props).toMatchObject({ width: 3840, height: 1646, fps: 30 });
    expect(props.audioChannels).toBeUndefined();
    expect(props.durationSeconds).toBeCloseTo(7.5, 0);
    const search = await probeVideo(path.join(workspace.outputDir, 'apple/tr-TR/creative-search-video/01-search.mp4'));
    expect(validateMedia(getSpec('apple.creative.search-video'), search)).toEqual([]);

    // Seamless: the jump from the last frame back to the first is no bigger than an ordinary step between two frames.
    const first = await frameAt(header, 0);
    const last = await frameAt(header, props.durationSeconds - 1 / 30);
    const step = meanDifference((await frameAt(header, 2)).data, (await frameAt(header, 2 + 1 / 30)).data);
    expect(meanDifference(last.data, first.data)).toBeLessThan(step * 1.5);
  }, 600_000);

  test('rejects a language outside the project before anything is rendered', async () => {
    const workspace = await videoWorkspace(recordingBytes({ seconds: 6 }));
    await expect(generateLoopVideos(workspace, { locales: 'fr-FR' })).rejects.toThrow();
    expect((await readManifest(workspace)).entries).toEqual([]);
  }, 60_000);
});
