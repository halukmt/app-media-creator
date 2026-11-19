import type { RegisterOptions } from '../export/manifest.js';
import { getSpec, inspectImageBytes, validateMedia, type Size } from '../specs/index.js';

/** Fixed sizes of a catalogue entry, smallest first. The catalogue is the only source of sizes. */
export function fixedSizes(specId: string): Size[] {
  const rule = getSpec(specId).dimensions;
  if (rule.kind !== 'fixed') throw new Error(`${specId} has no fixed sizes`);
  return [...rule.sizes].sort((a, b) => a.width - b.width);
}

/** Edge length of an entry with exactly one square size. */
export function squareSize(specId: string): number {
  const sizes = fixedSizes(specId);
  const [size] = sizes;
  if (sizes.length !== 1 || !size || size.width !== size.height) throw new Error(`${specId} has no single square size`);
  return size.width;
}

/** Checks every generated image against its catalogue entry before anything is written; documents are skipped. */
export async function assertValidOutputs(files: readonly RegisterOptions[]): Promise<void> {
  for (const file of files) {
    const spec = getSpec(file.specId);
    // Documents have no media properties; files copied from disk (videos) are measured by their generator.
    if (spec.kind === 'document' || file.bytes === undefined) continue;
    const label = `${file.name}.${file.extension}`;
    const violations = validateMedia(spec, await inspectImageBytes(file.bytes, label));
    if (violations.length > 0) {
      throw new Error(`Generated ${label} violates ${spec.id}: ${violations.map((v) => v.message).join('; ')}`);
    }
  }
}
