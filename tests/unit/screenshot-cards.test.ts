// conventions: RULE-TESTING-3301
import { tempDir } from '../factories/temp.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import {
  CARD_LAYOUTS,
  CardInputError,
  backgroundSvg,
  backgroundsFromPalette,
  balancedWrap,
  cardDefaultsForSpec,
  cardFont,
  cardSizeForSpec,
  fitText,
  frameForSpec,
  loadUserFrame,
  renderScreenshotCard,
  textColorFor,
  wrapText,
  type CardLayout,
  type FrameKind,
  type Measure,
} from '../../src/core/screenshots/index.js';
import { getSpec, inspectImageBytes, validateMedia } from '../../src/core/specs/index.js';
import { CARD_TEXTS, appScreenshot, gradientBackground, type CardLocale } from '../factories/screenshots.js';

/** Every character is 10 px wide at size 10 (scales with the size): predictable widths for layout tests. */
const mono: Measure = (text, size) => [...text].length * size;

describe('Card text is wrapped and fitted into its box', () => {
  test('wraps words greedily and keeps explicit line breaks', () => {
    expect(wrapText('one two three\nfour', 90, 10, mono).lines).toEqual(['one two', 'three', 'four']);
  });

  test('balances lines instead of leaving a short last line', () => {
    expect(wrapText('aaaa bbbb cc', 100, 10, mono).lines).toEqual(['aaaa bbbb', 'cc']);
    expect(balancedWrap('aaaa bbbb cc', 100, 10, mono).lines).toEqual(['aaaa', 'bbbb cc']);
  });

  test('hyphenates a word that is wider than the line', () => {
    const result = wrapText('Donaudampfschiff', 60, 10, mono);
    expect(result.brokenWord).toBe(true);
    expect(result.lines.every((line) => mono(line, 10) <= 60)).toBe(true);
    expect(result.lines.join('').replaceAll('-', '')).toBe('Donaudampfschiff');
  });

  test('keeps words joined by a no-break space on one line', () => {
    expect(wrapText('Prêt ? Allez', 60, 10, mono).lines).toEqual(['Prêt ?', 'Allez']);
  });

  test('hyphenates by code point and never splits a surrogate pair', () => {
    const lines = wrapText('😀😀😀😀😀😀😀😀', 40, 10, mono).lines;
    expect(lines.join('')).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  test('shrinks the text until it fits instead of breaking a word', () => {
    const fit = fitText({
      headline: 'Mannschaftsaufstellung',
      width: 200,
      height: 100,
      headlineSize: 20,
      sublineSize: 10,
      headlineLeading: 1,
      sublineLeading: 1,
      gap: 0,
      minScale: 0.3,
      measureHeadline: mono,
      measureSubline: mono,
    });
    expect(fit.headlineSize).toBeLessThan(20);
    expect(fit.brokenWord).toBe(false);
    expect(fit.overflow).toBe(false);
    expect(fit.headlineLines).toEqual(['Mannschaftsaufstellung']);
  });

  test('reports an overflow when the text does not fit even at the smallest size', () => {
    const fit = fitText({
      headline: 'a b c d e f g h i j k l m n o p',
      width: 20,
      height: 20,
      headlineSize: 20,
      sublineSize: 10,
      headlineLeading: 1,
      sublineLeading: 1,
      gap: 0,
      minScale: 0.5,
      measureHeadline: mono,
      measureSubline: mono,
    });
    expect(fit.overflow).toBe(true);
    expect(fit.headlineSize).toBeCloseTo(10);
  });
});

describe('The card font draws every character of the 6 media locales', () => {
  test('has glyphs for Turkish, German, Spanish, French and Italian letters', () => {
    const font = cardFont(800);
    expect(font.missing('İstanbul ğ ş ı ç ö ü Ä ß ñ é è à ò’')).toEqual([]);
    expect(font.measure('İ', 100)).toBeGreaterThan(0);
  });

  test('reports characters it cannot draw', () => {
    expect(cardFont(500).missing('Team 漢字')).toEqual(['漢', '字']);
  });
});

describe('Backgrounds come from presets and the logo palette', () => {
  test('picks dark text on light backgrounds and white text on dark ones', () => {
    expect(textColorFor({ kind: 'solid', color: '#f1f1f1' })).toBe('#0a0a0a');
    expect(textColorFor(gradientBackground())).toBe('#ffffff');
  });

  test('turns the logo palette into solid backgrounds and one gradient', () => {
    const presets = backgroundsFromPalette(['#dd1111', '#1133dd']);
    expect(presets.map((preset) => preset.background.kind)).toEqual(['solid', 'solid', 'gradient']);
    expect(backgroundsFromPalette([])).toEqual([]);
  });

  test('draws a gradient along the CSS angle', () => {
    const { defs, fill } = backgroundSvg({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 180 }, 100, 200);
    expect(fill).toBe('url(#bg)');
    // 180deg runs from top to bottom through the centre.
    expect(defs).toContain('x1="50.00" y1="0.00" x2="50.00" y2="200.00"');
  });
});

describe('Device frames match the screenshot specs', () => {
  test('maps store devices to generic frames', () => {
    expect(frameForSpec('apple.screenshot.iphone-6.3')).toBe('iphone');
    expect(frameForSpec('apple.screenshot.iphone-duo-inner')).toBe('iphone-duo');
    expect(frameForSpec('apple.screenshot.iphone-5.5')).toBe('iphone-home');
    expect(frameForSpec('apple.screenshot.ipad-13')).toBe('ipad');
    expect(frameForSpec('google.screenshot.phone')).toBe('android-phone');
    expect(frameForSpec('google.screenshot.tablet-10')).toBe('android-tablet');
  });

  test('has no generic frame for devices without one', () => {
    expect(frameForSpec('apple.screenshot.apple-tv')).toBe('none');
    expect(frameForSpec('google.screenshot.chromebook')).toBe('none');
  });

  test('uses an official bezel from the user frames folder instead of the generic frame', async () => {
    const dir = tempDir('amc-frames-');
    // A magenta bezel of 100 × 200 with a transparent screen area inside.
    const bezel = await sharp({ create: { width: 100, height: 200, channels: 4, background: '#ff00ff' } })
      .composite([{ input: { create: { width: 80, height: 180, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }, left: 10, top: 10, blend: 'dest-out' }])
      .png()
      .toBuffer();
    writeFileSync(path.join(dir, 'iphone.png'), bezel);
    writeFileSync(path.join(dir, 'iphone.json'), JSON.stringify({ width: 100, height: 200, screen: { x: 10, y: 10, width: 80, height: 180 } }));

    const { png } = await renderScreenshotCard({
      width: 400,
      height: 800,
      layout: 'text-top',
      headline: 'Bezel',
      background: { kind: 'solid', color: '#ffffff' },
      frame: 'iphone',
      userFramesDir: dir,
    });
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    let magenta = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i]! > 240 && data[i + 1]! < 20 && data[i + 2]! > 240) magenta += 1;
    expect(magenta).toBeGreaterThan(1000);
  });

  test('names the file when a user bezel description does not match its PNG', async () => {
    const dir = tempDir('amc-frames-');
    writeFileSync(path.join(dir, 'ipad.png'), await sharp({ create: { width: 100, height: 140, channels: 4, background: '#ff00ff' } }).png().toBuffer());
    writeFileSync(path.join(dir, 'ipad.json'), JSON.stringify({ width: 300, height: 420, screen: { x: 10, y: 10, width: 80, height: 120 } }));
    await expect(loadUserFrame(dir, 'ipad')).rejects.toThrow(/frames\/user\/ipad\.json says 300×420/);
    writeFileSync(path.join(dir, 'ipad.json'), '{ "width": 100, }');
    await expect(loadUserFrame(dir, 'ipad')).rejects.toThrow(/ipad\.json is not valid JSON/);
    expect(await loadUserFrame(dir, '../ipad' as FrameKind)).toBeNull();
  });
});

describe('renderScreenshotCard renders store-ready PNGs', () => {
  test('renders the iPhone 6.3" size as an opaque PNG that passes its spec', async () => {
    const spec = getSpec('apple.screenshot.iphone-6.3');
    const size = cardSizeForSpec(spec);
    const { png, warnings } = await renderScreenshotCard({
      ...size,
      layout: 'text-top',
      ...CARD_TEXTS['de-DE'],
      background: gradientBackground(),
      frame: frameForSpec(spec.id),
      screenshot: await appScreenshot(),
    });
    const props = await inspectImageBytes(png);
    expect([props.width, props.height, props.hasAlpha, props.format]).toEqual([size.width, size.height, false, 'png']);
    expect(validateMedia(spec, props)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  test('renders the Google Play phone default size and warns when the text covers too much of it', async () => {
    const spec = getSpec('google.screenshot.phone');
    const size = cardSizeForSpec(spec);
    expect(size).toEqual({ width: 1080, height: 1920 });
    const { png, warnings } = await renderScreenshotCard({
      ...size,
      layout: 'text-top-large',
      headline: 'Very large text that fills a lot of the card area',
      subline: 'and a subline that adds even more lines of text below it',
      background: { kind: 'solid', color: '#34c759' },
      frame: 'none',
      maxTextShare: 0.05,
    });
    expect(validateMedia(spec, await inspectImageBytes(png))).toEqual([]);
    expect(warnings.map((w) => w.code)).toContain('text-share');
  });

  test('warns when the headline cannot fit and when a character cannot be drawn', async () => {
    const { warnings } = await renderScreenshotCard({
      width: 300,
      height: 650,
      layout: 'text-bottom',
      headline: 'Donaudampfschifffahrtsgesellschaftskapitänsmütze '.repeat(12) + '漢',
      background: { kind: 'solid', color: '#0a0a0a' },
      frame: 'iphone',
    });
    expect(warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['text-overflow', 'word-broken', 'missing-glyphs']));
  });

  test('takes size, frame and text limit from the spec: Google Play without a frame and with the 20 % limit', () => {
    expect(cardDefaultsForSpec(getSpec('google.screenshot.phone'))).toEqual({ width: 1080, height: 1920, frame: 'none', maxTextShare: 0.2 });
    expect(cardDefaultsForSpec(getSpec('apple.screenshot.ipad-13'))).toEqual({ width: 2064, height: 2752, frame: 'ipad' });
  });

  test('draws decomposed Turkish letters (macOS NFD) like the precomposed ones', async () => {
    const card = (headline: string) =>
      renderScreenshotCard({ width: 300, height: 650, layout: 'text-top', headline, background: gradientBackground(), frame: 'none' });
    const [nfc, nfd] = await Promise.all([card('şampiyonluğa'), card('şampiyonluğa'.normalize('NFD'))]);
    expect(nfd.warnings).toEqual([]);
    expect(nfd.png.equals(nfc.png)).toBe(true);
  });

  test('rejects input that does not belong into an SVG', async () => {
    const base = { width: 300, height: 650, layout: 'text-top', headline: 'Hi', background: gradientBackground(), frame: 'iphone' } as const;
    await expect(renderScreenshotCard({ ...base, background: { kind: 'solid', color: '#fff" onload="x' as `#${string}` } })).rejects.toBeInstanceOf(CardInputError);
    await expect(renderScreenshotCard({ ...base, layout: 'sideways' as CardLayout })).rejects.toThrow(/Unknown layout/);
    await expect(renderScreenshotCard({ ...base, width: 650, height: 300 })).rejects.toThrow(/Landscape/);
    await expect(renderScreenshotCard({ ...base, width: 300.5 })).rejects.toThrow(/whole pixels/);
  });

  test('accepts only raster screenshots, not SVG', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect width="10" height="20"/></svg>');
    await expect(
      renderScreenshotCard({ width: 300, height: 650, layout: 'text-top', headline: 'Hi', background: gradientBackground(), frame: 'iphone', screenshot: svg }),
    ).rejects.toThrow(/PNG, JPEG or WebP/);
  });

  test('rejects a range spec without a default size', () => {
    expect(() => cardSizeForSpec(getSpec('google.screenshot.chromebook'))).toThrow(/no default size/);
  });
});

// Golden images: small cards (a quarter of the iPhone 6.3" size) for every layout in German and Turkish.
// Regenerate after an intended visual change with: UPDATE_GOLDEN=1 npx vitest run tests/unit/screenshot-cards.test.ts
const GOLDEN_DIR = path.join('tests', 'golden');
const ACTUAL_DIR = path.join('test-results', 'cards');

async function rawPixels(png: Buffer): Promise<Buffer> {
  return sharp(png).removeAlpha().raw().toBuffer();
}

describe('Card layouts match their golden images', () => {
  for (const layout of CARD_LAYOUTS) {
    for (const locale of Object.keys(CARD_TEXTS) as CardLocale[]) {
      test(`renders ${layout} in ${locale} like the golden image`, async () => {
        const { png } = await renderScreenshotCard({
          width: 295,
          height: 640,
          layout: layout as CardLayout,
          ...CARD_TEXTS[locale],
          background: gradientBackground(),
          frame: 'iphone',
          screenshot: await appScreenshot(),
        });
        mkdirSync(ACTUAL_DIR, { recursive: true });
        writeFileSync(path.join(ACTUAL_DIR, `card-${layout}-${locale}.png`), png);

        const golden = path.join(GOLDEN_DIR, `card-${layout}-${locale}.png`);
        if (process.env.UPDATE_GOLDEN || !existsSync(golden)) {
          mkdirSync(GOLDEN_DIR, { recursive: true });
          writeFileSync(golden, png);
          if (!process.env.UPDATE_GOLDEN) throw new Error(`${golden} was missing and has been written; check it and run again`);
          return;
        }
        const [actual, expected] = await Promise.all([rawPixels(png), rawPixels(readFileSync(golden))]);
        expect(actual.length).toBe(expected.length);
        // Small anti-aliasing differences between platforms are fine; a moved or changed element is not.
        let total = 0;
        let changed = 0;
        for (let i = 0; i < actual.length; i += 1) {
          const diff = Math.abs(actual[i]! - expected[i]!);
          total += diff;
          if (diff > 48) changed += 1;
        }
        expect(total / actual.length).toBeLessThan(1.5);
        expect(changed / actual.length).toBeLessThan(0.005);
      });
    }
  }
});
