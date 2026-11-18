import { isHexColor, type HexColor } from '../generators/render.js';

/** Card background: one colour, or a linear gradient with a CSS-style angle (0 = to top, 90 = to right). */
export type Background =
  | { kind: 'solid'; color: HexColor }
  | { kind: 'gradient'; from: HexColor; to: HexColor; angle: number };

export interface BackgroundPreset {
  id: string;
  name: string;
  background: Background;
}

/** Neutral presets; users get more from the colours of their logo (`backgroundsFromPalette`). */
export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  { id: 'blue', name: 'Blue', background: { kind: 'solid', color: '#0079dd' } },
  { id: 'navy', name: 'Navy', background: { kind: 'solid', color: '#003a72' } },
  { id: 'sky', name: 'Sky', background: { kind: 'solid', color: '#1f8def' } },
  { id: 'blue-gradient', name: 'Blue gradient', background: { kind: 'gradient', from: '#0079dd', to: '#4ea6f5', angle: 160 } },
  { id: 'deep-blue', name: 'Deep blue', background: { kind: 'gradient', from: '#003a72', to: '#0079dd', angle: 160 } },
  { id: 'light-grey', name: 'Light grey', background: { kind: 'solid', color: '#f1f1f1' } },
  { id: 'black', name: 'Black', background: { kind: 'solid', color: '#0a0a0a' } },
  { id: 'orange', name: 'Orange', background: { kind: 'solid', color: '#ff9f0a' } },
  { id: 'red', name: 'Red', background: { kind: 'solid', color: '#ff3b30' } },
  { id: 'green', name: 'Green', background: { kind: 'solid', color: '#34c759' } },
  { id: 'sunset', name: 'Sunset', background: { kind: 'gradient', from: '#ff9f0a', to: '#ff3b30', angle: 160 } },
  { id: 'field', name: 'Blue to green', background: { kind: 'gradient', from: '#0079dd', to: '#34c759', angle: 160 } },
];

/** One solid background per logo colour, plus a gradient of the first two colours. */
export function backgroundsFromPalette(palette: readonly HexColor[]): BackgroundPreset[] {
  const presets: BackgroundPreset[] = palette.map((color, index) => ({
    id: `logo-${index + 1}`,
    name: `Logo colour ${index + 1}`,
    background: { kind: 'solid', color },
  }));
  const [first, second] = palette;
  if (first && second) {
    presets.push({ id: 'logo-gradient', name: 'Logo gradient', background: { kind: 'gradient', from: first, to: second, angle: 160 } });
  }
  return presets;
}

export function isBackground(value: unknown): value is Background {
  if (typeof value !== 'object' || value === null) return false;
  const bg = value as Record<string, unknown>;
  if (bg.kind === 'solid') return isHexColor(bg.color);
  return (
    bg.kind === 'gradient' &&
    isHexColor(bg.from) &&
    isHexColor(bg.to) &&
    typeof bg.angle === 'number' &&
    Number.isFinite(bg.angle)
  );
}

function rgb(color: HexColor): [number, number, number] {
  const hex = color.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** Relative luminance (WCAG) of a colour, 0 (black) to 1 (white). */
export function luminance(color: HexColor): number {
  const [r, g, b] = rgb(color).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: HexColor, b: HexColor): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const DARK_TEXT: HexColor = '#0a0a0a';
const LIGHT_TEXT: HexColor = '#ffffff';

/**
 * Text colour with the better contrast against the background. For a gradient the lower contrast of both ends
 * decides, so the text stays readable across the whole card.
 */
export function textColorFor(background: Background): HexColor {
  const colors = background.kind === 'solid' ? [background.color] : [background.from, background.to];
  const worst = (text: HexColor) => Math.min(...colors.map((color) => contrast(text, color)));
  return worst(DARK_TEXT) > worst(LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT;
}

/**
 * SVG `defs` and fill for a background of the given size. The gradient line follows CSS `linear-gradient(<angle>deg)`
 * semantics: it runs through the centre, and its length makes the corners get the end colours.
 */
export function backgroundSvg(background: Background, width: number, height: number): { defs: string; fill: string } {
  if (background.kind === 'solid') return { defs: '', fill: background.color };
  const radians = (background.angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const coords = [cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half].map((v) => v.toFixed(2));
  return {
    defs:
      `<linearGradient id="bg" gradientUnits="userSpaceOnUse" x1="${coords[0]}" y1="${coords[1]}" x2="${coords[2]}" y2="${coords[3]}">` +
      `<stop offset="0" stop-color="${background.from}"/><stop offset="1" stop-color="${background.to}"/></linearGradient>`,
    fill: 'url(#bg)',
  };
}
