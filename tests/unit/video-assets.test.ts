// conventions: RULE-TESTING-3301
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { readManifest } from '../../src/core/export/index.js';
import { generateEmbedVideos, generateLoopVideos } from '../../src/core/generators/video-assets.js';
import { frameBox, frameOverlaySvg } from '../../src/core/screenshots/index.js';
import { getSpec, validateMedia } from '../../src/core/specs/index.js';
import { composeArgs, deviceScreen, embedLayout, planLoop, probeVideo, renderEmbedLayers, renderFrame, screenPixels } from '../../src/core/video/index.js';
import { saveCreativeSettings, saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { hasFfmpeg, recordingBytes } from '../factories/video.js';
import { projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const FFMPEG = hasFfmpeg();
const BACKGROUND = { kind: 'solid', color: '#1f8def' } as const;

describe('Device videos are laid out inside their canvas', () => {
  test('keeps text and device inside the canvas for every format, with and without text', () => {
    for (const [format, size] of [
      ['vertical', { width: 1080, height: 1920 }],
      ['landscape', { width: 1920, height: 1080 }],
      ['square', { width: 1080, height: 1080 }],
    ] as const) {
      for (const hasText of [true, false]) {
        const layout = embedLayout(format, size, 'iphone', 2.16, hasText);
        const d = layout.device;
        expect(d.x >= 0 && d.y >= 0 && d.x + d.width <= size.width && d.y + d.height <= size.height, `${format} ${hasText}`).toBe(true);
        if (layout.text) expect(layout.text.y + layout.text.height <= d.y || layout.text.x + layout.text.width <= d.x, `${format} text overlaps`).toBe(true);
        else expect(hasText).toBe(false);
      }
    }
  });

  test('rounds the screen to whole pixels that cover the frame opening', () => {
    const frame = frameBox('iphone', 400.4, 864.7);
    const screen = screenPixels(deviceScreen({ x: 10.6, y: 20.2 }, frame));
    expect(Number.isInteger(screen.x) && Number.isInteger(screen.width)).toBe(true);
    expect(screen.width).toBeGreaterThanOrEqual(frame.screen.width);
  });

  test('draws the frame over a video with the screen cut out, and nothing without a frame', () => {
    const frame = frameBox('iphone', 400, 864);
    const svg = frameOverlaySvg('iphone', 0, 0, frame, 'over');
    expect(svg).toContain('<mask id="over-hole"');
    expect(svg).not.toContain('feDropShadow');
    expect(frameOverlaySvg('none', 0, 0, frame, 'over')).toBe('');
  });

  test('covers the video corners and its extra pixel with the overlay, also without a frame', async () => {
    const layers = await renderEmbedLayers({ format: 'square', size: { width: 1080, height: 1080 }, kind: 'none', screenAspect: 2, text: '', background: BACKGROUND });
    const { data, info } = await sharp(layers.overlay).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = (x: number, y: number) => data[(y * info.width + x) * 4 + 3]!;
    const s = layers.screen;
    expect(alpha(s.x + Math.round(s.width / 2), s.y + Math.round(s.height / 2))).toBe(0);
    // The square corner of the video and its last pixel column lie under the overlay.
    expect(alpha(s.x + 1, s.y + 1)).toBe(255);
    expect(alpha(s.x + s.width - 1, s.y + Math.round(s.height / 2))).toBe(255);
  });
});

describe('planLoop joins the end of the recording to its start', () => {
  test('shortens the loop by the crossfade and cuts long recordings', () => {
    expect(planLoop({ sourceSeconds: 12, minSeconds: 5, maxSeconds: 30 })).toEqual({ clipStart: 0, clipSeconds: 12, totalSeconds: 11.5, shortened: false });
    expect(planLoop({ sourceSeconds: 60, trim: { start: 2 }, minSeconds: 5, maxSeconds: 30 })).toMatchObject({ clipSeconds: 30.5, totalSeconds: 30, shortened: true });
  });

  test('rejects a loop shorter than 5 s', () => {
    expect(() => planLoop({ sourceSeconds: 4, minSeconds: 5, maxSeconds: 30 })).toThrow(/loop would last 3.5 s; it needs 5–30 s/);
  });

  test('crossfades a looping video and keeps no audio, fades a device video and keeps its audio', () => {
    const base = { plate: 'p.png', overlay: 'o.png', source: 'rec.mp4', screen: { x: 10, y: 20, width: 300, height: 640 }, size: { width: 1080, height: 1920 }, fps: 30, output: 'out.mp4' };
    const loop = composeArgs({ ...base, plan: { clipStart: 0, clipSeconds: 12, totalSeconds: 11.5, shortened: false }, loop: true, audio: false });
    const loopFilter = loop[loop.indexOf('-filter_complex') + 1]!;
    expect(loopFilter).toContain('xfade=transition=fade:duration=0.5:offset=11');
    expect(loopFilter).toContain('overlay=10:20:shortest=1');
    expect(loop).toContain('-an');
    const embed = composeArgs({ ...base, plan: { clipStart: 1, clipSeconds: 10, totalSeconds: 10, shortened: false }, loop: false, audio: true });
    expect(embed[embed.indexOf('-filter_complex') + 1]).toContain('fade=t=out:st=9.7:d=0.3');
    expect(embed).toEqual(expect.arrayContaining(['-map', '[a]', '-protocol_whitelist', 'file']));
  });
});

/** A German and Turkish project with one German recording and header phrases. */
async function videoWorkspace(recording: Uint8Array): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }));
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  const settings = await saveCreativeSettings(workspace, { background: BACKGROUND, phrases: { 'de-DE': 'Faire Teams in Sekunden', 'tr-TR': 'Saniyeler içinde adil takımlar' } });
  if (!settings.ok) throw new Error(settings.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'teams.mp4', bytes: recording });
  return workspace;
}

/** Raw RGB of one frame of a video, as sharp reads it. */
async function frameAt(video: string, seconds: number): Promise<{ data: Buffer; width: number }> {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'amc-frame-')), 'frame.png');
  await renderFrame(video, seconds, file);
  const { data, info } = await sharp(readFileSync(file)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width };
}

function pixel(frame: { data: Buffer; width: number }, x: number, y: number): [number, number, number] {
  const i = (Math.round(y) * frame.width + Math.round(x)) * 3;
  return [frame.data[i]!, frame.data[i + 1]!, frame.data[i + 2]!];
}

function meanDifference(a: Buffer, b: Buffer): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i]! - b[i]!);
  return sum / a.length;
}

describe.skipIf(!FFMPEG)('Device and loop videos are rendered with ffmpeg', () => {
  test('writes device videos per language and format with the recording in the screen, de-DE and tr-TR', async () => {
    const workspace = await videoWorkspace(recordingBytes({ seconds: 6 }));
    const result = await generateEmbedVideos(workspace, { formats: ['vertical', 'square'], texts: { 'de-DE': 'Faire Teams', 'tr-TR': 'Adil takımlar' } });
    expect(result.entries.map((e) => e.path).sort()).toEqual([
      'web/de-DE/video-square/01-teams.mp4',
      'web/de-DE/video-vertical/01-teams.mp4',
      'web/tr-TR/video-square/01-teams.mp4',
      'web/tr-TR/video-vertical/01-teams.mp4',
    ]);
    expect(result.entries.find((e) => e.locale === 'tr-TR')?.fallbackInput).toBe(true);
    // A run for one format replaces only that format.
    await generateEmbedVideos(workspace, { locales: 'de-DE', formats: ['vertical'] });
    expect((await readManifest(workspace)).entries.filter((e) => e.locale === 'de-DE').map((e) => e.specId).sort()).toEqual(['web.video.square', 'web.video.vertical']);
    const vertical = path.join(workspace.outputDir, 'web/de-DE/video-vertical/01-teams.mp4');
    const props = await probeVideo(vertical);
    expect(validateMedia(getSpec('web.video.vertical'), props)).toEqual([]);
    expect(props).toMatchObject({ width: 1080, height: 1920, audioChannels: 2 });

    // The middle of the screen shows the recording, not the background.
    const layout = embedLayout('vertical', { width: 1080, height: 1920 }, 'iphone', 640 / 296, true);
    const centre = pixel(await frameAt(vertical, 2), layout.device.x + layout.device.width / 2, layout.device.y + layout.device.height / 2);
    const [r, g, b] = [0x1f, 0x8d, 0xef];
    expect(Math.abs(centre[0] - r) + Math.abs(centre[1] - g) + Math.abs(centre[2] - b)).toBeGreaterThan(30);
  }, 300_000);

  test('writes seamless, muted header and search loops with the Turkish phrase from the German recording', async () => {
    const workspace = await videoWorkspace(recordingBytes({ seconds: 8, audio: true }));
    // One language keeps the 4K render short; German is covered by the device video test above.
    const result = await generateLoopVideos(workspace, { locales: 'tr-TR' });
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

  test('explains a recording too short for a loop before anything is written', async () => {
    const workspace = await videoWorkspace(recordingBytes({ seconds: 4 }));
    await expect(generateLoopVideos(workspace)).rejects.toThrow(/loop would last 3.5 s; it needs 5–30 s/);
    expect((await readManifest(workspace)).entries).toEqual([]);
  }, 60_000);
});

describe('The video generators check their options', () => {
  test('rejects unknown formats and frames, foreign text languages, a disabled target and missing recordings', async () => {
    const workspace = await workspaceFactory();
    const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE'] }));
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await expect(generateEmbedVideos(workspace, { formats: ['portrait' as never] })).rejects.toThrow('formats must be a list of vertical, landscape, square');
    await expect(generateEmbedVideos(workspace, { frame: 'watch' as never })).rejects.toThrow('Unknown frame: watch');
    await expect(generateEmbedVideos(workspace, { texts: { 'fr-FR': 'Bonjour' } })).rejects.toThrow('texts: fr-FR is not a locale of this project');
    await expect(generateEmbedVideos(workspace)).rejects.toThrow('Upload a screen recording for de-DE first');
    const noWeb = projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE'] }) as { targets: { web: { enabled: boolean } } };
    noWeb.targets.web.enabled = false;
    await saveProject(workspace, noWeb);
    await expect(generateEmbedVideos(workspace)).rejects.toThrow('Turn on Web in Project to make device videos');
  });
});

describe('The video API guards the device and loop video options', () => {
  test('answers 400 for invalid formats and trims', async () => {
    const workspace = await workspaceFactory();
    const app = createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
    const post = (route: string, body: unknown) => app.request(route, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
    const embed = await post('/api/generate/embed-videos', { formats: 'vertical' });
    expect(embed.status).toBe(400);
    expect(await embed.json()).toEqual({ error: 'formats must be a list of vertical, landscape, square' });
    const loop = await post('/api/generate/loop-videos', { trim: { end: -2 } });
    expect(await loop.json()).toEqual({ error: 'trim must have a start and an end in seconds' });
  });
});
