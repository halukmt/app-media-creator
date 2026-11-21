// conventions: RULE-TESTING-3301
import { utimesSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { previewCache } from '../../src/server/preview-cache.js';
import { workspaceFactory } from '../factories/workspace.js';

async function sourceFile(name: string, text: string): Promise<string> {
  const file = path.join((await workspaceFactory()).root, name);
  writeFileSync(file, text);
  return file;
}

describe('Resized previews are cached until their file changes (#64)', () => {
  test('renders a preview once and answers again from the cache', async () => {
    const cache = previewCache();
    const file = await sourceFile('a.png', 'one');
    let renders = 0;
    const render = async () => Buffer.from(`preview ${++renders}`);
    expect((await cache.get(file, 'w240', render)).toString()).toBe('preview 1');
    expect((await cache.get(file, 'w240', render)).toString()).toBe('preview 1');
    // Another width is another preview.
    expect((await cache.get(file, 'w480', render)).toString()).toBe('preview 2');
  });

  test('renders again when the file was replaced, never answering with the old preview', async () => {
    const cache = previewCache();
    const file = await sourceFile('a.png', 'one');
    let renders = 0;
    const render = async () => Buffer.from(`preview ${++renders}`);
    await cache.get(file, 'w240', render);
    writeFileSync(file, 'two');
    const later = new Date(Date.now() + 5000);
    utimesSync(file, later, later);
    expect((await cache.get(file, 'w240', render)).toString()).toBe('preview 2');
  });

  test('renders once for requests that miss the same preview at the same time and counts it once (#124)', async () => {
    const cache = previewCache(10);
    const file = await sourceFile('a.png', 'one');
    let renders = 0;
    const render = async () => {
      renders += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return Buffer.alloc(4);
    };
    await Promise.all(Array.from({ length: 11 }, () => cache.get(file, 'w240', render)));
    expect(renders).toBe(1);
    expect(cache.bytes).toBe(4);
    // The capacity is intact: another preview still fits next to it.
    await cache.get(file, 'w480', async () => Buffer.alloc(4));
    expect(cache.size).toBe(2);
  });

  test('drops the oldest previews beyond its byte limit and fails for a missing file', async () => {
    const cache = previewCache(10);
    const file = await sourceFile('a.png', 'one');
    await cache.get(file, 'a', async () => Buffer.alloc(6));
    await cache.get(file, 'b', async () => Buffer.alloc(6));
    expect(cache.size).toBe(1);
    // Larger than the whole cache: served, not kept.
    await cache.get(file, 'c', async () => Buffer.alloc(20));
    expect(cache.size).toBe(1);
    await expect(cache.get(path.join(path.dirname(file), 'gone.png'), 'a', async () => Buffer.alloc(1))).rejects.toThrow();
  });
});
