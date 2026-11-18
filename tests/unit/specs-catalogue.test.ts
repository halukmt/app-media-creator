// conventions: RULE-TESTING-3301
import { describe, expect, test } from 'vitest';
import { SPECS, getSpec, listSpecs } from '../../src/core/specs/index.js';

describe('The spec catalogue covers every store and web media asset', () => {
  test('returns the required 6.3-inch iPhone screenshot with its sizes and rules', () => {
    const entry = getSpec('apple.screenshot.iphone-6.3');
    expect(entry.required).toBe(true);
    expect(entry.alpha).toBe('forbidden');
    expect(entry.formats).toEqual(['png', 'jpeg']);
    expect(entry.dimensions).toMatchObject({
      kind: 'fixed',
      sizes: [
        { width: 1179, height: 2556 },
        { width: 1206, height: 2622 },
      ],
    });
  });

  test('returns separate optional entries for the iPhone Duo outer and inner displays', () => {
    const outer = getSpec('apple.screenshot.iphone-duo-outer');
    const inner = getSpec('apple.screenshot.iphone-duo-inner');
    expect(outer.dimensions).toMatchObject({ sizes: [{ width: 1398, height: 2034 }] });
    expect(inner.dimensions).toMatchObject({ sizes: [{ width: 2007, height: 2853 }] });
    expect(outer.required || inner.required).toBe(false);
  });

  test('contains the creative assets for header and search results', () => {
    for (const id of [
      'apple.creative.header-image',
      'apple.creative.header-video',
      'apple.creative.search-image',
      'apple.creative.search-video',
      'apple.creative.universal-image',
    ]) {
      expect(getSpec(id).target).toBe('apple');
    }
  });

  test('reports an unknown asset instead of returning an empty entry', () => {
    expect(() => getSpec('apple.screenshot.iphone-99')).toThrow('Unknown media asset: apple.screenshot.iphone-99');
  });

  test('has unique ids', () => {
    expect(new Set(SPECS.map((e) => e.id)).size).toBe(SPECS.length);
  });

  test('gives every entry a target, required flag, dimension rule, format, alpha rule, verified flag and source URL', () => {
    for (const entry of SPECS) {
      expect(['apple', 'google', 'web'], entry.id).toContain(entry.target);
      expect(typeof entry.required, entry.id).toBe('boolean');
      expect(entry.dimensions.kind, entry.id).toBeDefined();
      if (entry.dimensions.kind === 'fixed') expect(entry.dimensions.sizes.length, entry.id).toBeGreaterThan(0);
      expect(entry.formats.length, entry.id).toBeGreaterThan(0);
      expect(['forbidden', 'allowed', 'required'], entry.id).toContain(entry.alpha);
      expect(typeof entry.verified, entry.id).toBe('boolean');
      expect(entry.sourceUrl, entry.id).toMatch(/^https:\/\//);
      if (entry.kind === 'video') expect(entry.video, entry.id).toBeDefined();
    }
  });

  test('marks third-party social sizes such as the Instagram profile picture as unverified', () => {
    expect(getSpec('web.social.instagram-profile').verified).toBe(false);
    expect(getSpec('web.og-image').verified).toBe(true);
  });
});

describe('listSpecs filters the catalogue', () => {
  test('lists the required Google Play assets: icon, feature graphic and phone screenshots', () => {
    const ids = listSpecs({ target: 'google', requiredOnly: true }).map((e) => e.id);
    expect(ids).toEqual(['google.icon', 'google.feature-graphic', 'google.screenshot.phone']);
  });

  test('lists only entries of the requested target and group', () => {
    const previews = listSpecs({ target: 'apple', group: 'preview' });
    expect(previews.length).toBeGreaterThan(0);
    expect(previews.every((e) => e.kind === 'video' && e.target === 'apple')).toBe(true);
  });

  test('returns an empty list when nothing matches', () => {
    expect(listSpecs({ target: 'web', group: 'preview' })).toEqual([]);
  });
});

describe('Document entries describe files that are not media', () => {
  test('describes the web app manifest as a JSON document without pixel size, in the favicons folder', () => {
    expect(getSpec('web.webmanifest')).toMatchObject({ kind: 'document', formats: ['json'], dimensions: { kind: 'none' }, folder: 'favicons' });
  });

  test('keeps all favicon files in one folder', () => {
    const folders = new Set(listSpecs({ target: 'web', group: 'favicon' }).map((e) => e.folder));
    expect([...folders]).toEqual(['favicons']);
  });
});

describe('App icon appearances and Icon Composer layers', () => {
  test('describes the Icon Composer background layer as an opaque 1024 PNG', () => {
    expect(getSpec('apple.icon-layer-background')).toMatchObject({
      formats: ['png'],
      alpha: 'forbidden',
      folder: 'icon-composer',
      dimensions: { kind: 'fixed', sizes: [{ width: 1024, height: 1024 }] },
    });
  });

  test('allows transparency for the dark and tinted appearances and marks them unverified', () => {
    for (const id of ['apple.icon-dark', 'apple.icon-tinted']) expect(getSpec(id)).toMatchObject({ alpha: 'allowed', verified: false, required: false });
  });
});

describe('Android launcher resources share one folder', () => {
  test('describes ic_launcher.xml as an XML document in android-res', () => {
    expect(getSpec('google.adaptive-icon.xml')).toMatchObject({ kind: 'document', formats: ['xml'], folder: 'android-res' });
    for (const id of ['google.adaptive-icon.foreground', 'google.adaptive-icon.background', 'google.adaptive-icon.monochrome', 'google.launcher-icon']) {
      expect(getSpec(id).folder, id).toBe('android-res');
    }
  });
});
