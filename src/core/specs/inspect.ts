import { open, stat } from 'node:fs/promises';
import sharp from 'sharp';
import type { MediaProperties } from './types.js';

// sharp uses `export =`; its namespace types are not reachable through the ESM default import.
type SharpMetadata = Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;

/** Width and height after EXIF orientation: rotated JPEGs store swapped pixels. */
function fromMetadata(metadata: SharpMetadata, bytes: number, label: string): MediaProperties {
  if (!metadata.width || !metadata.height || !metadata.format) throw new Error(`${label} is not a supported image`);
  return {
    width: metadata.autoOrient?.width ?? metadata.width,
    height: metadata.autoOrient?.height ?? metadata.height,
    format: metadata.format,
    hasAlpha: Boolean(metadata.hasAlpha),
    bytes,
  };
}

/**
 * Reads an ICONDIR (6-byte header plus 16 bytes per image). The largest image gives width and height
 * (a stored 0 means 256). Returns undefined when the bytes do not start like an ICO file.
 */
function parseIco(head: Buffer, bytes: number, label: string): MediaProperties | undefined {
  if (head.length < 6 || head.readUInt16LE(0) !== 0 || head.readUInt16LE(2) !== 1) return undefined;
  const count = head.readUInt16LE(4);
  if (count === 0 || head.length < 6 + count * 16) throw new Error(`${label} is not a supported image`);
  let width = 0;
  let height = 0;
  let hasAlpha = false;
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 16;
    const w = head.readUInt8(at) || 256;
    const h = head.readUInt8(at + 1) || 256;
    if (w * h > width * height) {
      width = w;
      height = h;
    }
    if (head.readUInt16LE(at + 6) === 32) hasAlpha = true;
  }
  return { width, height, format: 'ico', hasAlpha, bytes };
}

/**
 * Measures an image file: width, height (after EXIF orientation), format, alpha channel and byte size.
 * ICO files are measured from their directory, because sharp cannot read them.
 * Throws when the file does not exist or is not a supported image.
 */
export async function inspectImage(filePath: string): Promise<MediaProperties> {
  const { size } = await stat(filePath);
  const handle = await open(filePath, 'r');
  let head: Buffer;
  try {
    const first = Buffer.alloc(6);
    await handle.read(first, 0, 6, 0);
    const count = first.readUInt16LE(0) === 0 && first.readUInt16LE(2) === 1 ? first.readUInt16LE(4) : 0;
    head = Buffer.alloc(Math.min(size, 6 + count * 16));
    await handle.read(head, 0, head.length, 0);
  } finally {
    await handle.close();
  }
  const ico = parseIco(head, size, filePath);
  if (ico) return ico;
  try {
    return fromMetadata(await sharp(filePath).metadata(), size, filePath);
  } catch (cause) {
    throw new Error(`${filePath} is not a supported image`, { cause });
  }
}

/** Measures image bytes in memory, the same way as inspectImage measures a file. */
export async function inspectImageBytes(bytes: Uint8Array, label = 'The image'): Promise<MediaProperties> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ico = parseIco(buffer, buffer.length, label);
  if (ico) return ico;
  try {
    return fromMetadata(await sharp(buffer).metadata(), buffer.length, label);
  } catch (cause) {
    throw new Error(`${label} is not a supported image`, { cause });
  }
}
