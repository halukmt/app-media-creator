import type { Target } from './types.js';

/**
 * Device matrix: the screenshot specs the tool renders store cards for. All are portrait phones and tablets with a
 * generic frame; other screenshot specs (Mac, TV, Watch, Vision Pro, Chromebook, Wear OS …) stay in the catalogue
 * for validation but cannot be picked as devices yet.
 */
export const SCREENSHOT_MATRIX: Readonly<Record<Target, readonly string[]>> = {
  apple: [
    'apple.screenshot.iphone-6.9',
    'apple.screenshot.iphone-6.5',
    'apple.screenshot.iphone-6.3',
    'apple.screenshot.iphone-duo-outer',
    'apple.screenshot.iphone-duo-inner',
    'apple.screenshot.ipad-13',
  ],
  google: ['google.screenshot.phone', 'google.screenshot.tablet-7', 'google.screenshot.tablet-10'],
  web: [],
};
