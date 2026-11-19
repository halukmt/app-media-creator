import { Hono } from 'hono';
import { LOCALES } from '../core/locales/index.js';
import { getSpec, type Target } from '../core/specs/index.js';
import { cardSizeForSpec } from '../core/screenshots/index.js';
import { deviceOptions } from '../core/workspace/index.js';

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
}

function devicesOf(target: Target): CatalogueDevice[] {
  return deviceOptions(target).map((id) => {
    const spec = getSpec(id);
    const { width, height } = cardSizeForSpec(spec);
    return { id, name: spec.name, required: spec.required, ...(spec.condition ? { condition: spec.condition } : {}), size: { width, height } };
  });
}

/** Builds the data the UI needs to render choices: locales and device models per target. */
export function buildCatalogue(): Catalogue {
  return {
    locales: LOCALES.map(({ id, name, nativeName }) => ({ id, name, nativeName })),
    devices: { apple: devicesOf('apple'), google: devicesOf('google'), web: devicesOf('web') },
  };
}

/** `GET /api/catalogue`: static data, independent of the workspace. */
export function catalogueRoutes(): Hono {
  const api = new Hono();
  const catalogue = buildCatalogue();
  api.get('/catalogue', (c) => c.json(catalogue));
  return api;
}
