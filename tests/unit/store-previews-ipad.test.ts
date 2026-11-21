// conventions: RULE-TESTING-3301
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { readManifest } from '../../src/core/export/index.js';
import { generateStorePreviews } from '../../src/core/generators/store-previews.js';
import { probeVideo } from '../../src/core/video/index.js';
import { saveProject } from '../../src/core/workspace/index.js';
import { hasFfmpeg, previewWorkspace, recordingBytes } from '../factories/video.js';
import { projectInputFactory } from '../factories/workspace.js';

const FFMPEG = hasFfmpeg();

// A file of its own: two full-size previews per run, in parallel to the other preview tests (#77).
describe.skipIf(!FFMPEG)('generateStorePreviews renders the iPad preview and replaces earlier ones', () => {
  test('adds silent stereo audio, an iPad preview in landscape and replaces earlier previews', async () => {
    const workspace = await previewWorkspace(recordingBytes({ seconds: 16, width: 640, height: 360, audio: false }), ['apple.screenshot.iphone-6.9', 'apple.screenshot.ipad-13']);
    const first = await generateStorePreviews(workspace, { locales: 'de-DE' });
    expect(first.entries.map((e) => e.specId).sort()).toEqual(['apple.preview.ipad', 'apple.preview.iphone']);
    const ipad = await probeVideo(path.join(workspace.outputDir, first.entries.find((e) => e.specId === 'apple.preview.ipad')!.path));
    expect(ipad).toMatchObject({ width: 1600, height: 1200, audioChannels: 2 });
    // Without an iPad size in the project, the iPad preview goes with the next run and the iPhone one is replaced.
    const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }));
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await generateStorePreviews(workspace, { locales: 'de-DE' });
    expect((await readManifest(workspace)).entries.map((e) => e.specId)).toEqual(['apple.preview.iphone']);
  }, 300_000);

  test('makes no iPad preview while the project has no iPad size', async () => {
    const workspace = await previewWorkspace(recordingBytes({ seconds: 4 }), ['apple.screenshot.iphone-6.9']);
    await expect(generateStorePreviews(workspace, { locales: 'de-DE' })).rejects.toThrow(/15–30 s/);
    expect((await readManifest(workspace)).entries.filter((e) => e.specId === 'apple.preview.ipad')).toEqual([]);
  }, 60_000);
});
