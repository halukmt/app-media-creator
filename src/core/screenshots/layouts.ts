/**
 * The three card layouts of the original prototype, as shares of the card size so they scale to every device.
 * - `text-top`: headline above a fully visible device.
 * - `text-top-large`: headline above a larger device that runs off the bottom edge.
 * - `text-bottom`: device on top, headline below.
 */
export type CardLayout = 'text-top' | 'text-top-large' | 'text-bottom';

export const CARD_LAYOUTS: readonly CardLayout[] = ['text-top', 'text-top-large', 'text-bottom'];

export interface LayoutRatios {
  /** Text box: top edge and height as shares of the card height; side padding as a share of the width. */
  text: { top: number; height: number; side: number };
  /** Device: outer width and top edge as shares of the card; `maxBottom` limits a fully visible device. */
  device: { width: number; top: number; maxBottom: number | null };
  /** Start font sizes as shares of the card width; text shrinks from here to fit. */
  headline: number;
  subline: number;
}

export const LAYOUT_RATIOS: Record<CardLayout, LayoutRatios> = {
  'text-top': {
    text: { top: 0.05, height: 0.15, side: 0.07 },
    device: { width: 0.66, top: 0.22, maxBottom: 0.97 },
    headline: 0.082,
    subline: 0.04,
  },
  'text-top-large': {
    text: { top: 0.06, height: 0.22, side: 0.07 },
    device: { width: 0.85, top: 0.3, maxBottom: null },
    headline: 0.09,
    subline: 0.04,
  },
  'text-bottom': {
    text: { top: 0.78, height: 0.18, side: 0.07 },
    device: { width: 0.6, top: 0.05, maxBottom: 0.76 },
    headline: 0.075,
    subline: 0.038,
  },
};

export function isCardLayout(value: unknown): value is CardLayout {
  return typeof value === 'string' && (CARD_LAYOUTS as readonly string[]).includes(value);
}

export interface Placement {
  text: { x: number; y: number; width: number; height: number };
  device: { x: number; y: number; width: number; height: number };
}

/**
 * Places text box and device on a card. `deviceAspect` is outer height / outer width of the framed device. A fully
 * visible device that would cross `maxBottom` is made narrower; `text-top-large` may run off the bottom edge.
 */
export function placeCard(layout: CardLayout, width: number, height: number, deviceAspect: number): Placement {
  const r = LAYOUT_RATIOS[layout];
  let deviceWidth = width * r.device.width;
  const deviceTop = height * r.device.top;
  if (r.device.maxBottom !== null) {
    const room = height * r.device.maxBottom - deviceTop;
    if (deviceWidth * deviceAspect > room) deviceWidth = room / deviceAspect;
  }
  return {
    text: { x: width * r.text.side, y: height * r.text.top, width: width * (1 - 2 * r.text.side), height: height * r.text.height },
    device: { x: (width - deviceWidth) / 2, y: deviceTop, width: deviceWidth, height: deviceWidth * deviceAspect },
  };
}
