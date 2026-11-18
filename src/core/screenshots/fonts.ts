import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
// The package is CommonJS for Node: only the default export carries `parse`.
import opentype, { type Font, type Glyph } from 'opentype.js';

/**
 * Inter (SIL OFL 1.1, via @fontsource/inter) for card text. Text is turned into SVG paths, so the rendered pixels do
 * not depend on fonts installed on the machine. Fontsource splits Inter into a `latin` and a `latin-ext` file; each
 * character takes its glyph from the first file that has it (Turkish ğ İ ş are only in `latin-ext`).
 *
 * Glyphs are placed one by one: opentype.js cannot apply Inter's contextual substitution tables, so there are no
 * ligatures and no kerning. Headlines at card sizes do not need either.
 */

export type FontWeight = 500 | 800;

export interface TextRun {
  /** SVG path data of the text, baseline at `y`. */
  path: string;
  width: number;
}

export interface CardFont {
  /** Width of `text` at `size` px. */
  measure(text: string, size: number): number;
  /** SVG path of `text` starting at (x, baseline y). */
  path(text: string, x: number, y: number, size: number): TextRun;
  /** Characters of `text` that no font file has a glyph for. */
  missing(text: string): string[];
  /** Ascender and descender as a share of the font size (descender negative). */
  ascent: number;
  descent: number;
}

const require = createRequire(import.meta.url);

function loadFont(file: string): Font {
  const bytes = readFileSync(require.resolve(`@fontsource/inter/files/${file}`));
  return opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

/** Letter spacing in em, as in the card design (tight headlines). */
const TRACKING: Record<FontWeight, number> = { 500: 0, 800: -0.02 };

function createCardFont(weight: FontWeight): CardFont {
  const fonts = [loadFont(`inter-latin-${weight}-normal.woff`), loadFont(`inter-latin-ext-${weight}-normal.woff`)];
  const primary = fonts[0] as Font;
  const tracking = TRACKING[weight];

  function glyphOf(char: string): { font: Font; glyph: Glyph } | null {
    for (const font of fonts) {
      const index = font.charToGlyphIndex(char);
      if (index > 0) return { font, glyph: font.glyphs.get(index) };
    }
    return null;
  }

  function advance(char: string, size: number): number {
    const found = glyphOf(char) ?? { font: primary, glyph: primary.glyphs.get(0) };
    return ((found.glyph.advanceWidth ?? 0) / found.font.unitsPerEm) * size + tracking * size;
  }

  return {
    measure(text, size) {
      let width = 0;
      for (const char of text) width += advance(char, size);
      return Math.max(0, width - tracking * size);
    },
    path(text, x, y, size) {
      let cursor = x;
      const parts: string[] = [];
      for (const char of text) {
        const found = glyphOf(char);
        if (found) parts.push(found.glyph.getPath(cursor, y, size).toPathData(2));
        cursor += advance(char, size);
      }
      return { path: parts.filter(Boolean).join(''), width: Math.max(0, cursor - x - tracking * size) };
    },
    missing(text) {
      return [...new Set([...text].filter((char) => !/\s/.test(char) && glyphOf(char) === null))];
    },
    ascent: primary.ascender / primary.unitsPerEm,
    descent: primary.descender / primary.unitsPerEm,
  };
}

const cache = new Map<FontWeight, CardFont>();

/** The card font in the given weight (800 for headlines, 500 for sublines); loaded once per process. */
export function cardFont(weight: FontWeight): CardFont {
  let font = cache.get(weight);
  if (!font) {
    font = createCardFont(weight);
    cache.set(weight, font);
  }
  return font;
}
