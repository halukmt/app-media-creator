import { Hono } from 'hono';
import { LOCALES } from '../core/locales/index.js';
import { STORE_TEXT_SPECS, getSpec, type StoreTextSpec, type Target } from '../core/specs/index.js';
import { cardSizeForSpec } from '../core/screenshots/index.js';
import { CREATIVE_IMAGES, creativeGeometry, type CreativeGroup } from '../core/generators/creative-assets.js';
import { ENVIRONMENT_COLORS, MAX_BADGE_LENGTH, MAX_ENVIRONMENTS, MAX_PHRASE, deviceOptions, type EnvironmentColor } from '../core/workspace/index.js';

export interface CatalogueDevice {
  id: string;
  name: string;
  required: boolean;
  condition?: string;
  /** Pixel size the cards are rendered at for this device. */
  size: { width: number; height: number };
}

export interface Catalogue {
  locales: { id: string; name: string; nativeName: string }[];
  devices: Record<Target, CatalogueDevice[]>;
  /** Label colour presets of environments (icon variants), as data for swatches. */
  environmentColors: { id: EnvironmentColor; color: string }[];
  maxEnvironments: number;
  maxBadgeLength: number;
  /**
   * Store artwork from screenshots, in display order: size and key-art area in pixels. `storeSafeArea` is true when the
   * area is the store's art safe area, false for the centred key area of images without one.
   */
  creativeImages: {
    specId: string;
    name: string;
    group: CreativeGroup;
    target: Target;
    text: boolean;
    size: { width: number; height: number };
    safeArea: { x: number; y: number; width: number; height: number };
    storeSafeArea: boolean;
  }[];
  maxPhrase: number;
  /** Store text fields with their limits, in catalogue order (paste order per store). */
  storeTexts: StoreTextSpec[];
  /** The videos the tool writes: the size it renders (portrait for previews) and the allowed length. */
  videos: { specId: string; name: string; size: { width: number; height: number }; minSeconds: number; maxSeconds: number }[];
}

/** Video entries the Video section writes (#20, #21). */
const VIDEO_SPECS = [
  'apple.preview.iphone',
  'apple.preview.ipad',
  'web.video.vertical',
  'web.video.landscape',
  'web.video.square',
  'apple.creative.header-video',
  'apple.creative.search-video',
] as const;

function videosOf(): Catalogue['videos'] {
  return VIDEO_SPECS.map((id) => {
    const spec = getSpec(id);
    const rule = spec.dimensions;
    const size = rule.kind === 'fixed' ? rule.sizes[0] : rule.kind === 'range' ? rule.min : undefined;
    if (!size || !spec.video) throw new Error(`${id} has no video size or limits`);
    return { specId: id, name: spec.name, size: { width: size.width, height: size.height }, minSeconds: spec.video.minSeconds, maxSeconds: spec.video.maxSeconds };
  });
}

function devicesOf(target: Target): CatalogueDevice[] {
  return deviceOptions(target).map((id) => {
    const spec = getSpec(id);
    const { width, height } = cardSizeForSpec(spec);
    return { id, name: spec.name, required: spec.required, ...(spec.condition ? { condition: spec.condition } : {}), size: { width, height } };
  });
}

/** Builds the data the UI needs to render choices: locales, device models per target and environment colours. */
export function buildCatalogue(): Catalogue {
  return {
    locales: LOCALES.map(({ id, name, nativeName }) => ({ id, name, nativeName })),
    devices: { apple: devicesOf('apple'), google: devicesOf('google'), web: devicesOf('web') },
    environmentColors: Object.entries(ENVIRONMENT_COLORS).map(([id, color]) => ({ id: id as EnvironmentColor, color })),
    maxEnvironments: MAX_ENVIRONMENTS,
    maxBadgeLength: MAX_BADGE_LENGTH,
    creativeImages: CREATIVE_IMAGES.map((image) => {
      const spec = getSpec(image.specId);
      const { width, height, safeArea } = creativeGeometry(image);
      return {
        specId: image.specId,
        name: spec.name,
        group: image.group,
        target: spec.target,
        text: image.text,
        size: { width, height },
        safeArea,
        storeSafeArea: spec.safeArea !== undefined,
      };
    }),
    maxPhrase: MAX_PHRASE,
    storeTexts: [...STORE_TEXT_SPECS],
    videos: videosOf(),
  };
}

/** `GET /api/catalogue`: static data, independent of the workspace. */
export function catalogueRoutes(): Hono {
  const api = new Hono();
  const catalogue = buildCatalogue();
  api.get('/catalogue', (c) => c.json(catalogue));
  return api;
}
