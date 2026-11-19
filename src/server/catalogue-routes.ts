import { Hono } from 'hono';
import { LOCALES } from '../core/locales/index.js';
import { getSpec, type Target } from '../core/specs/index.js';
import { cardSizeForSpec } from '../core/screenshots/index.js';
import { CREATIVE_IMAGES } from '../core/generators/creative-assets.js';
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
  /** App Store header, search and universal images: size and art safe area in pixels, in display order. */
  creativeImages: { specId: string; name: string; size: { width: number; height: number }; safeArea: { x: number; y: number; width: number; height: number } }[];
  maxPhrase: number;
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
    creativeImages: CREATIVE_IMAGES.map(({ specId }) => {
      const spec = getSpec(specId);
      const { width, height } = cardSizeForSpec(spec);
      return { specId, name: spec.name, size: { width, height }, safeArea: spec.safeArea! };
    }),
    maxPhrase: MAX_PHRASE,
  };
}

/** `GET /api/catalogue`: static data, independent of the workspace. */
export function catalogueRoutes(): Hono {
  const api = new Hono();
  const catalogue = buildCatalogue();
  api.get('/catalogue', (c) => c.json(catalogue));
  return api;
}
