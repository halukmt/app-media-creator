/**
 * Line breaking and fitting for card text. Pure: the width of a string comes from an injected `measure` function, so
 * the logic is tested without fonts. Works for any script that separates words with spaces (all 6 media locales).
 */

/** Width of `text` at font size `size`. */
export type Measure = (text: string, size: number) => number;

/**
 * Splits text into lines no wider than `maxWidth`. Explicit line breaks (`\n`) are kept. A single word wider than
 * the line is broken between characters with a hyphen; the result reports that as `brokenWord`.
 */
export function wrapText(text: string, maxWidth: number, size: number, measure: Measure): { lines: string[]; brokenWord: boolean } {
  const lines: string[] = [];
  let brokenWord = false;

  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word, size) <= maxWidth) {
        line = word;
        continue;
      }
      // The word alone is too wide: break it into pieces that fit, each but the last ending with a hyphen.
      brokenWord = true;
      let rest = word;
      while (measure(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && measure(`${rest.slice(0, cut)}-`, size) > maxWidth) cut -= 1;
        lines.push(`${rest.slice(0, cut)}-`);
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return { lines, brokenWord };
}

/**
 * Wraps with the narrowest width that keeps the line count of a greedy wrap, so lines come out evenly long
 * ("balanced") instead of one long line and a short last word.
 */
export function balancedWrap(text: string, maxWidth: number, size: number, measure: Measure): { lines: string[]; brokenWord: boolean } {
  const greedy = wrapText(text, maxWidth, size, measure);
  if (greedy.lines.length < 2 || greedy.brokenWord) return greedy;
  let low = maxWidth / 2;
  let high = maxWidth;
  let best = greedy;
  for (let step = 0; step < 12; step += 1) {
    const middle = (low + high) / 2;
    const attempt = wrapText(text, middle, size, measure);
    if (attempt.lines.length === greedy.lines.length && !attempt.brokenWord) {
      best = attempt;
      high = middle;
    } else {
      low = middle;
    }
  }
  return best;
}

export interface FitInput {
  headline: string;
  subline?: string;
  /** Text box in px. */
  width: number;
  height: number;
  headlineSize: number;
  sublineSize: number;
  /** Line height as a multiple of the font size. */
  headlineLeading: number;
  sublineLeading: number;
  /** Gap between headline and subline, as a multiple of the headline size. */
  gap: number;
  /** Smallest allowed share of the start sizes (e.g. 0.5). */
  minScale: number;
  measureHeadline: Measure;
  measureSubline: Measure;
}

export interface FitResult {
  headlineSize: number;
  sublineSize: number;
  headlineLines: string[];
  sublineLines: string[];
  /** Total height of the text block in px. */
  height: number;
  /** The text is taller than the box even at the smallest size. */
  overflow: boolean;
  /** A word was broken with a hyphen because it is wider than the box at the smallest size. */
  brokenWord: boolean;
}

/** Shrinks headline and subline together in 5 % steps until the block fits the box; never below `minScale`. */
export function fitText(input: FitInput): FitResult {
  let result: FitResult | null = null;
  for (let scale = 1; scale >= input.minScale - 1e-9; scale -= 0.05) {
    const headlineSize = input.headlineSize * scale;
    const sublineSize = input.sublineSize * scale;
    // Prefer shrinking over breaking a word: skip sizes where a word would have to be broken, unless it is the last try.
    const head = balancedWrap(input.headline, input.width, headlineSize, input.measureHeadline);
    const sub = input.subline ? balancedWrap(input.subline, input.width, sublineSize, input.measureSubline) : { lines: [], brokenWord: false };
    const height =
      head.lines.length * headlineSize * input.headlineLeading +
      (sub.lines.length > 0 ? input.gap * headlineSize + sub.lines.length * sublineSize * input.sublineLeading : 0);
    const brokenWord = head.brokenWord || sub.brokenWord;
    result = {
      headlineSize,
      sublineSize,
      headlineLines: head.lines,
      sublineLines: sub.lines,
      height,
      overflow: height > input.height,
      brokenWord,
    };
    if (!result.overflow && !brokenWord) return result;
  }
  // `result` holds the smallest size: report what is left (overflow and/or a broken word).
  return result as FitResult;
}
