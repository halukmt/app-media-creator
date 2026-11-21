import { stat } from 'node:fs/promises';

/** Upper bound of all cached preview bytes; the oldest previews are dropped first. */
export const PREVIEW_CACHE_BYTES = 32 * 1024 * 1024;

/**
 * Small in-memory cache for rendered previews (resized output images, the logo preview), so a preview grid does not
 * resize every file again on each request (#64). The key includes the source file's size and modification time, so a
 * regenerated or replaced file is never answered with an old preview.
 */
export function previewCache(maxBytes = PREVIEW_CACHE_BYTES) {
  const entries = new Map<string, Buffer>();
  /** Renders in flight: requests that miss the same key at the same time share one render (#124). */
  const rendering = new Map<string, Promise<Buffer>>();
  let total = 0;

  const store = (key: string, bytes: Buffer) => {
    if (bytes.length > maxBytes) return;
    const previous = entries.get(key);
    if (previous) {
      entries.delete(key);
      total -= previous.length;
    }
    entries.set(key, bytes);
    total += bytes.length;
    for (const [oldKey, oldBytes] of entries) {
      if (total <= maxBytes) break;
      entries.delete(oldKey);
      total -= oldBytes.length;
    }
  };

  return {
    /** The cached preview of `file` for `variant`, rendered with `render` when missing or the file changed. */
    async get(file: string, variant: string, render: () => Promise<Buffer>): Promise<Buffer> {
      const info = await stat(file);
      const key = `${file}\0${info.size}\0${info.mtimeMs}\0${variant}`;
      const hit = entries.get(key);
      if (hit) {
        // Most recently used goes to the end.
        entries.delete(key);
        entries.set(key, hit);
        return hit;
      }
      let pending = rendering.get(key);
      if (!pending) {
        pending = render()
          .then((bytes) => {
            store(key, bytes);
            return bytes;
          })
          .finally(() => rendering.delete(key));
        rendering.set(key, pending);
      }
      return pending;
    },
    /** Sum of the cached bytes (for tests). */
    get bytes(): number {
      return total;
    },
    get size(): number {
      return entries.size;
    },
  };
}

export type PreviewCache = ReturnType<typeof previewCache>;
