// conventions: RULE-TESTING-3301
import { describe, expect, it } from 'vitest';
import { groupOutputs, groupStatus } from '../../src/web/lib/logo.js';

const icon = (density: string, width: number) => ({
  path: `google/shared/mipmap-${density}/ic_launcher.png`,
  specId: 'google-launcher-icon',
  name: 'Launcher icon',
  width,
  height: width,
});

describe('groupOutputs', () => {
  it('puts all densities of one asset into one group led by the largest image', () => {
    const groups = groupOutputs([icon('mdpi', 48), icon('xxxhdpi', 192), icon('hdpi', 72)]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.files).toHaveLength(3);
    expect(groups[0]!.largest?.width).toBe(192);
    expect(groups[0]!.widths).toEqual([48, 192]);
  });

  it('keeps languages apart and puts documents last', () => {
    const groups = groupOutputs([
      { path: 'web/shared/favicons/site.webmanifest', specId: 'web-manifest', name: 'Web manifest' },
      { path: 'web/de-DE/og-image/01-og-image.png', specId: 'web-og', name: 'Open Graph image', locale: 'de-DE', width: 1200, height: 630 },
      { path: 'web/tr-TR/og-image/01-og-image.png', specId: 'web-og', name: 'Open Graph image', locale: 'tr-TR', width: 1200, height: 630 },
    ]);
    expect(groups.map((g) => g.locale ?? 'shared')).toEqual(['de-DE', 'tr-TR', 'shared']);
    expect(groups[2]!.largest).toBeUndefined();
  });

  it('puts the languages of one asset next to each other', () => {
    const share = (specId: string, locale: string) => ({ path: `web/${locale}/${specId}.png`, specId, name: specId, locale, width: 1200, height: 630 });
    const groups = groupOutputs([share('og', 'de-DE'), share('x', 'de-DE'), share('og', 'tr-TR'), share('x', 'tr-TR')]);
    expect(groups.map((g) => `${g.name} ${g.locale}`)).toEqual(['og de-DE', 'og tr-TR', 'x de-DE', 'x tr-TR']);
  });
});

describe('groupStatus', () => {
  it('reports the worst status and each message once', () => {
    const statuses = new Map([
      ['a', { status: 'ok' as const, messages: [] }],
      ['b', { status: 'warning' as const, messages: ['Too large'] }],
      ['c', { status: 'warning' as const, messages: ['Too large'] }],
    ]);
    expect(groupStatus([{ path: 'a' }, { path: 'b' }, { path: 'c' }], statuses)).toEqual({ status: 'warning', messages: ['Too large'] });
  });

  it('is undefined while no file has a status', () => {
    expect(groupStatus([{ path: 'x' }], new Map())).toBeUndefined();
  });
});
