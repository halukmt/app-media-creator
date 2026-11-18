import { APPLE_SPECS } from './apple.js';
import { GOOGLE_SPECS } from './google.js';
import type { AssetGroup, SpecEntry, Target } from './types.js';
import { WEB_SPECS } from './web.js';

/** Every spec entry of every target, in the order Apple, Google Play, web. */
export const SPECS: readonly SpecEntry[] = Object.freeze([...APPLE_SPECS, ...GOOGLE_SPECS, ...WEB_SPECS]);

const BY_ID = new Map(SPECS.map((entry) => [entry.id, entry]));

/** Returns the entry with the given id. Throws for an unknown id. */
export function getSpec(id: string): SpecEntry {
  const entry = BY_ID.get(id);
  if (!entry) throw new Error(`Unknown media asset: ${id}`);
  return entry;
}

export interface SpecFilter {
  target?: Target;
  group?: AssetGroup;
  /** Only entries the store requires unconditionally. */
  requiredOnly?: boolean;
}

/** Lists entries, optionally filtered by target, group and required flag. */
export function listSpecs(filter: SpecFilter = {}): SpecEntry[] {
  return SPECS.filter(
    (entry) =>
      (filter.target === undefined || entry.target === filter.target) &&
      (filter.group === undefined || entry.group === filter.group) &&
      (!filter.requiredOnly || entry.required),
  );
}
