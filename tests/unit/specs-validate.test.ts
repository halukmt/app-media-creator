// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { getSpec, matchesDimensions, validateMedia } from '../../src/core/specs/index.js';
import { imagePropsFactory, videoPropsFactory } from '../factories/media.js';

const iphone63 = getSpec('apple.screenshot.iphone-6.3');

describe('The iPad app preview sizes follow the device generation (#30)', () => {
  test('accepts 1200×1600 and 900×1200 for the 12.9" (2nd gen), and only 900×1200 for the 9.7"', () => {
    const large = getSpec('apple.preview.ipad-12.9').dimensions;
    const small = getSpec('apple.preview.ipad-9.7').dimensions;
    expect(matchesDimensions(large, 1200, 1600)).toBe(true);
    expect(matchesDimensions(large, 900, 1200)).toBe(true);
    expect(matchesDimensions(small, 900, 1200)).toBe(true);
    expect(matchesDimensions(small, 1200, 1600)).toBe(false);
  });
});

describe('validateMedia checks a generated file against its spec entry', () => {
  test('accepts a 1206×2622 PNG without alpha of 2 MB as a 6.3-inch iPhone screenshot', () => {
    expect(validateMedia(iphone63, imagePropsFactory())).toEqual([]);
  });

  test('accepts the landscape variant of a rotatable screenshot size', () => {
    expect(validateMedia(iphone63, imagePropsFactory({ width: 2622, height: 1206 }))).toEqual([]);
  });

  test('reports both the wrong size and the alpha channel at once', () => {
    const violations = validateMedia(iphone63, imagePropsFactory({ width: 1200, height: 2600, hasAlpha: true }));
    expect(violations.map((v) => v.rule)).toEqual(['dimensions', 'alpha']);
    expect(violations[0]?.message).toContain('1200×2600');
  });

  test('reports a Play icon above the 1024 KB limit', () => {
    const icon = getSpec('google.icon');
    const violations = validateMedia(icon, imagePropsFactory({ width: 512, height: 512, bytes: 1.5 * 1024 * 1024 }));
    expect(violations).toEqual([{ rule: 'fileSize', message: 'File size 1.5 MB exceeds the limit of 1 MB' }]);
  });

  test('accepts a 2400×1600 search results image and rejects a 1000×667 one', () => {
    const search = getSpec('apple.creative.search-image');
    expect(validateMedia(search, imagePropsFactory({ width: 2400, height: 1600 }))).toEqual([]);
    expect(validateMedia(search, imagePropsFactory({ width: 1000, height: 667 })).map((v) => v.rule)).toEqual(['dimensions']);
  });

  test('rejects a portrait image for the landscape-only search results asset', () => {
    const search = getSpec('apple.creative.search-image');
    expect(validateMedia(search, imagePropsFactory({ width: 1600, height: 2400 })).map((v) => v.rule)).toEqual(['dimensions']);
  });

  test('applies the Play rule that the long side is at most twice the short side', () => {
    const phone = getSpec('google.screenshot.phone');
    expect(validateMedia(phone, imagePropsFactory({ width: 1080, height: 1920 }))).toEqual([]);
    expect(validateMedia(phone, imagePropsFactory({ width: 1000, height: 2100 })).map((v) => v.rule)).toEqual(['dimensions']);
  });

  test('rejects a format the entry does not allow', () => {
    const header = getSpec('apple.creative.header-image');
    const violations = validateMedia(header, imagePropsFactory({ width: 3840, height: 1646, format: 'jpg' }));
    expect(violations).toEqual([{ rule: 'format', message: 'Format jpeg is not allowed; use png' }]);
  });

  test('requires alpha when the entry demands transparency', () => {
    const entry = { ...getSpec('web.og-image'), alpha: 'required' as const };
    expect(validateMedia(entry, imagePropsFactory({ width: 1200, height: 630 })).map((v) => v.rule)).toEqual(['alpha']);
  });

  test('accepts any size for a vector icon', () => {
    const svg = getSpec('web.icon-svg');
    expect(validateMedia(svg, imagePropsFactory({ width: 24, height: 24, format: 'svg', hasAlpha: true }))).toEqual([]);
  });
});

describe('validateMedia checks video limits', () => {
  const preview = getSpec('apple.preview.iphone');

  test('accepts a 25-second 886×1920 preview at 30 fps with stereo audio', () => {
    expect(validateMedia(preview, videoPropsFactory())).toEqual([]);
  });

  test('reports a 35-second preview as outside the 15 to 30 second limit', () => {
    const violations = validateMedia(preview, videoPropsFactory({ durationSeconds: 35 }));
    expect(violations).toEqual([{ rule: 'duration', message: 'Duration 35 s is outside 15–30 s' }]);
  });

  test('reports 60 fps, missing audio and an unmeasured duration', () => {
    const { durationSeconds: _ignored, ...withoutDuration } = videoPropsFactory({ fps: 60 });
    delete withoutDuration.audioChannels;
    const rules = validateMedia(preview, withoutDuration).map((v) => v.rule);
    expect(rules).toEqual(['duration', 'frameRate', 'audio']);
  });

  test('accepts only 30 or 60 fps for a looping header video', () => {
    const header = getSpec('apple.creative.header-video');
    const props = videoPropsFactory({ width: 3840, height: 1646, durationSeconds: 10 });
    expect(validateMedia(header, props)).toEqual([]);
    expect(validateMedia(header, { ...props, fps: 25 }).map((v) => v.rule)).toEqual(['frameRate']);
  });

  test('reports an image file given for a video entry without extra video violations', () => {
    const rules = validateMedia(preview, imagePropsFactory({ width: 886, height: 1920 })).map((v) => v.rule);
    expect(rules).toEqual(['kind', 'format']);
  });

  test('accepts NTSC frame rates 29.97 and 59.94 as 30 and 60 fps', () => {
    const header = getSpec('apple.creative.header-video');
    const props = videoPropsFactory({ width: 3840, height: 1646, durationSeconds: 10 });
    expect(validateMedia(header, { ...props, fps: 59.94 })).toEqual([]);
    expect(validateMedia(header, { ...props, fps: 29.97 })).toEqual([]);
    expect(validateMedia(preview, videoPropsFactory({ fps: 29.97 }))).toEqual([]);
  });

  test('accepts the comma-separated container list that video probes report', () => {
    expect(validateMedia(preview, videoPropsFactory({ format: 'mov,mp4,m4a,3gp,3g2,mj2' }))).toEqual([]);
    const rules = validateMedia(preview, videoPropsFactory({ format: 'matroska,webm' })).map((v) => v.rule);
    expect(rules).toEqual(['kind', 'format']);
  });
});
