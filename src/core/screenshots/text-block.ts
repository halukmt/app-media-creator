import { svgNumber as n } from './frames.js';
import { cardFont } from './fonts.js';
import type { CardWarning } from './render.js';
import { fitText } from './text-layout.js';

export interface TextBlockInput {
  /** Box the text must fit into. */
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle?: string;
  /** Start sizes in px; both shrink together down to half until the text fits. */
  titleSize: number;
  subtitleSize: number;
  color: string;
  align: 'left' | 'center';
  /** Vertical position of the text block inside the box. */
  valign?: 'top' | 'middle';
}

const LEADING = { title: 1.1, subtitle: 1.3 } as const;

/**
 * Text drawn as SVG paths (bold title, regular subtitle) fitted into a box, for share images and banners. Returns the
 * SVG elements and the same warnings as screenshot cards (overflow, hyphenated word, missing characters).
 */
export function textBlockSvg(input: TextBlockInput): { svg: string; warnings: CardWarning[] } {
  const heavy = cardFont(800);
  const regular = cardFont(500);
  const title = input.title.normalize('NFC').trim();
  const subtitle = input.subtitle?.normalize('NFC').trim() || undefined;
  const fit = fitText({
    headline: title,
    ...(subtitle ? { subline: subtitle } : {}),
    width: input.width,
    height: input.height,
    headlineSize: input.titleSize,
    sublineSize: input.subtitleSize,
    headlineLeading: LEADING.title,
    sublineLeading: LEADING.subtitle,
    gap: 0.3,
    minScale: 0.5,
    measureHeadline: (text, size) => heavy.measure(text, size),
    measureSubline: (text, size) => regular.measure(text, size),
  });

  const warnings: CardWarning[] = [];
  if (fit.overflow) warnings.push({ code: 'text-overflow', message: 'The text does not fit into its area even at the smallest size; shorten it' });
  if (fit.brokenWord) warnings.push({ code: 'word-broken', message: 'A word is too long for one line and was hyphenated; shorten it' });
  const missing = [...new Set([...heavy.missing(title), ...regular.missing(subtitle ?? '')])];
  if (missing.length > 0) warnings.push({ code: 'missing-glyphs', message: `These characters cannot be drawn: ${missing.join(' ')}` });

  let top = input.y + (input.valign === 'middle' ? Math.max(0, (input.height - fit.height) / 2) : 0);
  const paths: string[] = [];
  const draw = (lines: string[], size: number, leading: number, font: typeof heavy, opacity: number) => {
    const parts: string[] = [];
    for (const line of lines) {
      const width = font.measure(line, size);
      const x = input.align === 'center' ? input.x + (input.width - width) / 2 : input.x;
      const baseline = top + (leading * size - (font.ascent - font.descent) * size) / 2 + font.ascent * size;
      parts.push(font.path(line, x, baseline, size).path);
      top += leading * size;
    }
    if (parts.length > 0) paths.push(`<path fill="${input.color}"${opacity < 1 ? ` fill-opacity="${n(opacity)}"` : ''} d="${parts.join('')}"/>`);
  };
  draw(fit.headlineLines, fit.headlineSize, LEADING.title, heavy, 1);
  if (fit.sublineLines.length > 0) {
    top += 0.3 * fit.headlineSize;
    draw(fit.sublineLines, fit.sublineSize, LEADING.subtitle, regular, 0.9);
  }
  return { svg: paths.join(''), warnings };
}
