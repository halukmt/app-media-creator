/** Store or channel an asset is made for. */
export type Target = 'apple' | 'google' | 'web';

/** Broad asset family, used for grouping in the UI and the export folder layout. */
export type AssetGroup =
  | 'screenshot'
  | 'preview'
  | 'creative'
  | 'event'
  | 'icon'
  | 'feature-graphic'
  | 'banner'
  | 'favicon'
  | 'share'
  | 'social'
  /** App screenshots in a device frame for websites (no store requirement). */
  | 'mockup'
  /** Variants of the logo itself (monochrome, inverse, square mark). */
  | 'logo'
  /** App videos in a device frame on a background, for websites and social posts (no store requirement). */
  | 'video';

/** `document` covers files of an asset set that are not media, e.g. a web app manifest or an HTML snippet. */
export type MediaKind = 'image' | 'video' | 'document';

export type MediaFormat =
  | 'png'
  | 'jpeg'
  | 'webp'
  | 'gif'
  | 'svg'
  | 'ico'
  | 'mp4'
  | 'mov'
  | 'm4v'
  | 'json'
  | 'html'
  | 'txt'
  | 'xml';

/** Whether a file may, must or must not have an alpha channel. */
export type AlphaRule = 'forbidden' | 'allowed' | 'required';

export interface Size {
  width: number;
  height: number;
}

/** Aspect rule on the ratio long side / short side, independent of orientation. */
export type AspectRule =
  | { ratio: number; tolerance: number }
  | { maxRatio: number };

export type Orientation = 'portrait' | 'landscape' | 'any';

/**
 * Allowed pixel dimensions.
 * - fixed: one of the listed sizes; `rotatable` also allows each size with width and height swapped.
 * - range: long and short side within bounds (`min`/`max` compare long with long and short with short),
 *   optional per-side bounds, aspect rule and orientation.
 * - vector: scalable format without fixed pixels (SVG).
 * - none: documents, which have no pixels.
 */
export type DimensionRule =
  | { kind: 'fixed'; sizes: readonly Size[]; rotatable: boolean }
  | {
      kind: 'range';
      min?: Size;
      max?: Size;
      minSide?: number;
      maxSide?: number;
      aspect?: AspectRule;
      orientation: Orientation;
    }
  | { kind: 'vector' }
  | { kind: 'none' };

export interface VideoLimits {
  minSeconds: number;
  maxSeconds: number;
  /** Highest allowed frame rate. */
  maxFps?: number;
  /** Only these frame rates are allowed. */
  allowedFps?: readonly number[];
  /** Required number of audio channels (2 = stereo); omitted when audio is optional or silent. */
  audioChannels?: number;
}

/** Rectangle in pixels, relative to the top-left corner of the full asset. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpecEntry {
  /** Stable id, e.g. `apple.screenshot.iphone-6.3`. Used by generators and the export layout. */
  id: string;
  target: Target;
  group: AssetGroup;
  /** Human-readable name. */
  name: string;
  kind: MediaKind;
  /** True when the store rejects a submission without this asset. */
  required: boolean;
  /** When the asset is required only under a condition (e.g. "if the app runs on iPad"). */
  condition?: string;
  dimensions: DimensionRule;
  formats: readonly MediaFormat[];
  alpha: AlphaRule;
  maxBytes?: number;
  minCount?: number;
  maxCount?: number;
  video?: VideoLimits;
  /** Area that must hold the key art (Apple creative assets, YouTube banner). */
  safeArea?: Rect;
  /**
   * Pixel size the tool renders for a range rule (the store allows many sizes). Must satisfy `dimensions`;
   * fixed rules use their first size instead.
   */
  defaultSize?: Size;
  /** Device width in pixels at 1x for framed website screenshots; 2x doubles it. */
  baseWidth?: number;
  /** Largest share of the image that overlay text may cover (Google Play screenshots: under 20 %). */
  maxTextShare?: number;
  /** The store discourages device frames around screenshots (Google Play). */
  discouragesFrames?: boolean;
  /** Output folder name instead of the default derived from the id (assets that ship together share a folder). */
  folder?: string;
  /** True when a separate file is generated per media locale. */
  localized: boolean;
  /** True when the values come from the store's own documentation. */
  verified: boolean;
  sourceUrl: string;
  notes?: string;
}

/** Properties measured from a generated file. */
export interface MediaProperties {
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  bytes: number;
  durationSeconds?: number;
  fps?: number;
  audioChannels?: number;
}

export type ViolationRule = 'kind' | 'dimensions' | 'format' | 'alpha' | 'fileSize' | 'duration' | 'frameRate' | 'audio';

export interface Violation {
  rule: ViolationRule;
  message: string;
}
