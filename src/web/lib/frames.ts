/** Device frames the UI offers (generic frames drawn by the tool; `none` is a separate option where it applies). */
export const FRAME_KINDS = ['iphone', 'iphone-home', 'iphone-duo', 'ipad', 'android-phone', 'android-tablet'] as const;
export type UiFrameKind = (typeof FRAME_KINDS)[number];
