// conventions: RULE-TESTING-3301
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { exportChecklist, readManifest } from '../../src/core/export/index.js';
import { GeneratorError } from '../../src/core/generators/logo.js';
import { generateStorePreviews, renderPreviewFrame } from '../../src/core/generators/store-previews.js';
import { getSpec, inspectImageBytes, validateMedia } from '../../src/core/specs/index.js';
import {
  PreviewError,
  ffprobeBinary,
  orientedSize,
  parseProbe,
  planPreview,
  previewArgs,
  probeVideo,
  renderTextCard,
} from '../../src/core/video/index.js';
import { saveInput, saveProject, type Workspace } from '../../src/core/workspace/index.js';
import { createApp } from '../../src/server/app.js';
import { packageInfoFactory } from '../factories/package-info.js';
import { hasFfmpeg, probeJsonFactory, recordingBytes } from '../factories/video.js';
import { mp4Bytes, projectInputFactory, workspaceFactory } from '../factories/workspace.js';

const LIMITS = { minSeconds: 15, maxSeconds: 30 };
const FFMPEG = hasFfmpeg();

describe('planPreview decides which part of the recording goes into the preview', () => {
  test('keeps a recording that fits and counts the text cards', () => {
    expect(planPreview({ sourceSeconds: 12, intro: true, outro: true, cardSeconds: 2, ...LIMITS })).toEqual({
      clipStart: 0,
      clipSeconds: 12,
      introSeconds: 2,
      outroSeconds: 2,
      totalSeconds: 16,
      shortened: false,
    });
  });

  test('cuts a long recording at the end so the preview stays within 30 s', () => {
    const plan = planPreview({ sourceSeconds: 60, trim: { start: 5 }, intro: true, outro: false, cardSeconds: 3, ...LIMITS });
    expect(plan).toMatchObject({ clipStart: 5, clipSeconds: 27, totalSeconds: 30, shortened: true });
  });

  test('rejects a preview shorter than 15 s, a trim outside the recording and a card length out of range', () => {
    expect(() => planPreview({ sourceSeconds: 10, intro: false, outro: false, cardSeconds: 2, ...LIMITS })).toThrow(PreviewError);
    expect(() => planPreview({ sourceSeconds: 10, intro: false, outro: false, cardSeconds: 2, ...LIMITS })).toThrow(/would last 10 s; the App Store needs 15–30 s/);
    expect(() => planPreview({ sourceSeconds: 20, trim: { start: 18, end: 25 }, intro: false, outro: false, cardSeconds: 2, ...LIMITS })).toThrow(/inside the recording/);
    expect(() => planPreview({ sourceSeconds: 20, intro: true, outro: false, cardSeconds: 9, ...LIMITS })).toThrow('Text cards last 1–5 s');
  });
});

describe('The preview keeps the orientation of the recording', () => {
  test('uses the portrait size for a portrait recording and the landscape size for a landscape one', () => {
    expect(orientedSize({ width: 886, height: 1920 }, { width: 590, height: 1278 })).toEqual({ width: 886, height: 1920 });
    expect(orientedSize({ width: 886, height: 1920 }, { width: 1920, height: 1080 })).toEqual({ width: 1920, height: 886 });
  });
});

describe('previewArgs builds one ffmpeg run without a shell', () => {
  const plan = { clipStart: 1, clipSeconds: 12, introSeconds: 2, outroSeconds: 0, totalSeconds: 14, shortened: false };
  const base = { plan, source: 'in put.mp4', size: { width: 886, height: 1920 }, fps: 30, padColor: '#0a0a0a', output: 'out.mp4' };

  test('adds a silent stereo track for a recording without audio and joins card and recording', () => {
    const args = previewArgs({ ...base, sourceHasAudio: false, introCard: 'intro.png' });
    const filter = args[args.indexOf('-filter_complex') + 1]!;
    expect(args.filter((arg) => arg === 'anullsrc=r=48000:cl=stereo')).toHaveLength(2);
    expect(filter).toContain('pad=886:1920:(ow-iw)/2:(oh-ih)/2:color=0x0a0a0a');
    expect(filter).toContain('concat=n=2:v=1:a=1[v][a]');
    expect(args).toEqual(expect.arrayContaining(['in put.mp4', 'libx264', '11M', '256k', '30']));
    // Only local files are read from the recording.
    expect(args.slice(args.indexOf('in put.mp4') - 7, args.indexOf('in put.mp4') - 5)).toEqual(['-protocol_whitelist', 'file']);
    expect(args.slice(-3)).toEqual(['-t', '14', 'out.mp4']);
  });

  test('keeps the recording\'s own audio as stereo when it has one', () => {
    const args = previewArgs({ ...base, sourceHasAudio: true });
    expect(args).not.toContain('anullsrc=r=48000:cl=stereo');
    expect(args[args.indexOf('-filter_complex') + 1]).toContain('[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo');
  });
});

describe('parseProbe reads ffprobe\'s answer', () => {
  test('reads size, frame rate, duration and audio, and turns a rotated recording upright', () => {
    expect(parseProbe(probeJsonFactory({ fps: '30000/1001' }))).toMatchObject({ width: 886, height: 1920, durationSeconds: 20, audioChannels: 2 });
    expect(parseProbe(probeJsonFactory({ fps: '30000/1001' })).fps).toBeCloseTo(29.97, 2);
    expect(parseProbe(probeJsonFactory({ width: 1920, height: 886, rotation: -90 }))).toMatchObject({ width: 886, height: 1920 });
    expect(parseProbe(probeJsonFactory({ audio: false })).audioChannels).toBeUndefined();
  });

  test('rejects a file without a video track or a readable duration', () => {
    expect(() => parseProbe(JSON.stringify({ streams: [{ codec_type: 'audio', channels: 2 }], format: {} }))).toThrow('The file has no video track');
    expect(() => parseProbe(probeJsonFactory({ duration: 'N/A' }))).toThrow(/duration could not be measured/);
    expect(() => parseProbe('not json')).toThrow(/no readable result/);
  });

  test('finds ffprobe next to FFMPEG_PATH and reports it as missing when it cannot be started', async () => {
    const tools = path.join('C:', 'tools');
    expect(ffprobeBinary({ FFMPEG_PATH: path.join(tools, 'ffmpeg.exe') }, () => true)).toBe(path.join(tools, 'ffprobe.exe'));
    // No ffprobe beside a standalone ffmpeg: the one on the PATH.
    expect(ffprobeBinary({ FFMPEG_PATH: path.join(tools, 'ffmpeg-static') }, () => false)).toBe('ffprobe');
    // A wrapper with another name: never ffmpeg itself as ffprobe (#106).
    expect(ffprobeBinary({ FFMPEG_PATH: path.join(tools, 'custom-encoder') }, () => true)).toBe('ffprobe');
    expect(ffprobeBinary({ FFPROBE_PATH: '/opt/ffprobe', FFMPEG_PATH: '/usr/bin/ffmpeg' })).toBe('/opt/ffprobe');
    expect(ffprobeBinary({})).toBe('ffprobe');
    const missing = async () => Promise.reject(Object.assign(new Error('spawn ffprobe ENOENT'), { code: 'ENOENT' }));
    await expect(probeVideo('x.mp4', missing, 'ffprobe')).rejects.toThrow(/ffprobe was not found/);
  });
});

describe('Text cards are drawn per language', () => {
  test('renders a card in the store size, also with Turkish letters', async () => {
    const card = await renderTextCard({ size: { width: 886, height: 1920 }, text: 'Saniyeler içinde adil takımlar', background: { kind: 'solid', color: '#0a0a0a' } });
    const props = await inspectImageBytes(card.png);
    expect([props.width, props.height, props.hasAlpha]).toEqual([886, 1920, false]);
    expect(card.warnings).toEqual([]);
  });
});

/** A German and Turkish project with one German recording. */
async function previewWorkspace(recording: Uint8Array, devices?: string[]): Promise<Workspace> {
  const workspace = await workspaceFactory();
  const input = projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }) as { targets: { apple: { devices: string[] } } };
  if (devices) input.targets.apple.devices = devices;
  const saved = await saveProject(workspace, input);
  if (!saved.ok) throw new Error(saved.errors.join('; '));
  await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'teams.mp4', bytes: recording });
  return workspace;
}

describe.skipIf(!FFMPEG)('generateStorePreviews renders App Store previews with ffmpeg', () => {
  test('writes a valid iPhone preview per language with text cards, de-DE and tr-TR (fallback input)', async () => {
    const workspace = await previewWorkspace(recordingBytes({ seconds: 12 }), ['apple.screenshot.iphone-6.9', 'apple.screenshot.iphone-duo-outer']);
    const result = await generateStorePreviews(workspace, {
      intro: { 'de-DE': 'Faire Teams in Sekunden', 'tr-TR': 'Saniyeler içinde adil takımlar' },
      outro: { 'de-DE': 'Jetzt laden', 'tr-TR': 'Hemen indir' },
    });
    expect(result.entries.map((e) => e.path).sort()).toEqual(['apple/de-DE/preview-iphone/01-teams.mp4', 'apple/tr-TR/preview-iphone/01-teams.mp4']);
    expect(result.entries.find((e) => e.locale === 'tr-TR')?.fallbackInput).toBe(true);
    expect(result.warnings.map((w) => w.message).join(' ')).toMatch(/iPhone Duo .* experimental/);
    for (const entry of result.entries) {
      const props = await probeVideo(path.join(workspace.outputDir, entry.path));
      expect(validateMedia(getSpec('apple.preview.iphone'), props), entry.path).toEqual([]);
      expect(props).toMatchObject({ width: 886, height: 1920, audioChannels: 2 });
      expect(props.durationSeconds).toBeCloseTo(16, 0);
    }
    const apple = (await exportChecklist(workspace, { locales: ['de-DE'] })).targets.find((t) => t.target === 'apple');
    expect(apple?.items.find((i) => i.specId === 'apple.preview.iphone' && i.locale === 'de-DE')?.status).toBe('ok');

    const frame = await renderPreviewFrame(workspace, 'apple/de-DE/preview-iphone/01-teams.mp4', 5);
    expect(await inspectImageBytes(frame)).toMatchObject({ width: 886, height: 1920 });
    await expect(renderPreviewFrame(workspace, 'apple/de-DE/preview-iphone/01-teams.mp4', 25)).rejects.toThrow(/seconds must be from 0 to below 16/);
    await expect(renderPreviewFrame(workspace, 'apple/de-DE/../../project.json', 1)).rejects.toThrow('There is no generated preview video at this path');
  }, 180_000);

  test('adds silent stereo audio, an iPad preview in landscape and replaces earlier previews', async () => {
    const workspace = await previewWorkspace(recordingBytes({ seconds: 16, width: 640, height: 360, audio: false }), ['apple.screenshot.iphone-6.9', 'apple.screenshot.ipad-13']);
    const first = await generateStorePreviews(workspace, { locales: 'de-DE' });
    expect(first.entries.map((e) => e.specId).sort()).toEqual(['apple.preview.ipad', 'apple.preview.iphone']);
    const ipad = await probeVideo(path.join(workspace.outputDir, first.entries.find((e) => e.specId === 'apple.preview.ipad')!.path));
    expect(ipad).toMatchObject({ width: 1600, height: 1200, audioChannels: 2 });
    await generateStorePreviews(workspace, { locales: 'de-DE' });
    expect((await readManifest(workspace)).entries.filter((e) => e.locale === 'de-DE')).toHaveLength(2);
    // Without an iPad size in the project, the iPad preview goes with the next run.
    const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] }));
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await generateStorePreviews(workspace, { locales: 'de-DE' });
    expect((await readManifest(workspace)).entries.map((e) => e.specId)).toEqual(['apple.preview.iphone']);
  }, 300_000);

  test('explains a recording that is too short before anything is written', async () => {
    const workspace = await previewWorkspace(recordingBytes({ seconds: 6 }));
    await expect(generateStorePreviews(workspace)).rejects.toThrow(/would last 6 s; the App Store needs 15–30 s/);
    expect((await readManifest(workspace)).entries).toEqual([]);
  }, 60_000);
});

describe('generateStorePreviews explains what is missing', () => {
  test('asks for a recording, rejects unknown card languages and names a missing ffmpeg', async () => {
    const workspace = await workspaceFactory();
    const saved = await saveProject(workspace, projectInputFactory({ sourceLocale: 'de-DE', locales: ['de-DE'] }));
    if (!saved.ok) throw new Error(saved.errors.join('; '));
    await expect(generateStorePreviews(workspace)).rejects.toThrow(new GeneratorError('Upload a screen recording for de-DE first'));
    await expect(generateStorePreviews(workspace, { intro: { 'fr-FR': 'Bonjour' } })).rejects.toThrow('intro: fr-FR is not a locale of this project');
    await expect(generateStorePreviews(workspace, { cardSeconds: 0 })).rejects.toThrow('cardSeconds must be 1–5 seconds');

    await saveInput(workspace, 'de-DE', { kind: 'video', locale: 'de-DE', originalName: 'teams.mp4', bytes: mp4Bytes() });
    const missing = async () => Promise.reject(Object.assign(new Error('spawn ffprobe ENOENT'), { code: 'ENOENT' }));
    await expect(generateStorePreviews(workspace, {}, { capture: missing })).rejects.toThrow(/ffprobe was not found/);
  });
});

describe('The video API checks the tools and guards its inputs', () => {
  const appFor = (workspace: Workspace) => createApp({ webRoot: 'does-not-exist', packageInfo: packageInfoFactory(), workspace });
  const post = (workspace: Workspace, body: unknown) =>
    appFor(workspace).request('/api/generate/store-previews', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });

  test('says whether ffmpeg and ffprobe can be started', async () => {
    const response = await appFor(await workspaceFactory()).request('/api/video/tools');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ffmpeg: FFMPEG, ffprobe: expect.any(Boolean) });
  });

  test('rejects invalid card texts, trims and frame paths with 400', async () => {
    const workspace = await workspaceFactory();
    expect((await post(workspace, { intro: ['Hallo'] })).status).toBe(400);
    expect(await (await post(workspace, { trim: { start: -1 } })).json()).toEqual({ error: 'trim must have a start and an end in seconds' });
    const frame = await appFor(workspace).request(`/api/video/frame?path=${encodeURIComponent('../project.json')}&seconds=1`);
    expect(frame.status).toBe(400);
    expect(await frame.json()).toEqual({ error: 'There is no generated preview video at this path' });
  });
});
