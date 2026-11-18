import { stat } from 'node:fs/promises';
import sharp from 'sharp';
import type { MediaProperties } from './types.js';

// sharp uses `export =`; its namespace types are not reachable through the ESM default import.
type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

/**
 * Measures an image file: width, height (after EXIF orientation), format, alpha channel and byte size.
 * Throws when the file does not exist or is not an image sharp can read.
 * ICO files are not supported by sharp; the favicon generator measures them itself.
 */
export async function inspectImage(filePath: string): Promise<MediaProperties> {
  const { size } = await stat(filePath);
  let metadata: SharpMetadata;
  try {
    metadata = await sharp(filePath).metadata();
  } catch (cause) {
    throw new Error(`${filePath} is not a supported image`, { cause });
  }
  if (!metadata.width || !metadata.height || !metadata.format) {
    throw new Error(`${filePath} is not a supported image`);
  }
  // Rotated JPEGs store swapped pixels; validation must see the displayed orientation.
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  return {
    width,
    height,
    format: metadata.format,
    hasAlpha: Boolean(metadata.hasAlpha),
    bytes: size,
  };
}
