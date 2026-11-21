import { tempDir } from './temp.js';
import path from 'node:path';
import sharp from 'sharp';
import { defaultProject, openWorkspace, type ProjectSettings, type Workspace } from '../../src/core/workspace/index.js';

/** A fresh workspace in a new temporary repo folder named `demo-repo`. */
export async function workspaceFactory(): Promise<Workspace> {
  const repo = path.join(tempDir('amc-ws-'), 'demo-repo');
  return openWorkspace(path.join(repo, '.app-media'));
}

/** Project settings as the API receives them; override what a test needs. */
export function projectInputFactory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const base: ProjectSettings = defaultProject('Demo');
  return { ...base, ...overrides };
}

/** Bytes of a small PNG image. */
export async function pngBytes(width = 20, height = 40): Promise<Uint8Array<ArrayBuffer>> {
  // Uint8Array.from copies into a plain ArrayBuffer, which File and Blob accept.
  return Uint8Array.from(
    await sharp({ create: { width, height, channels: 3, background: '#3366cc' } }).png().toBuffer(),
  );
}

/** Bytes of a minimal SVG logo. */
export function svgBytes(): Uint8Array {
  return new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#09f"/></svg>',
  );
}

/**
 * Bytes of an ISO base media file header: a leading box of the given type with a major brand
 * (or the first payload word) and compatible brands. Enough for type detection.
 */
export function isoBytes(box: string, major: string, compatible: string[]): Uint8Array {
  const size = 16 + compatible.length * 4;
  const bytes = new Uint8Array(Math.max(size, 32));
  new DataView(bytes.buffer).setUint32(0, size);
  bytes.set(new TextEncoder().encode(box + major), 4);
  compatible.forEach((brand, index) => bytes.set(new TextEncoder().encode(brand), 16 + index * 4));
  return bytes;
}

/** Bytes that start like an MP4 file (ftyp box with brand isom). */
export function mp4Bytes(): Uint8Array {
  return isoBytes('ftyp', 'isom', ['isom', 'mp42']);
}
