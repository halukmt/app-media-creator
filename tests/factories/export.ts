import { tempDir } from './temp.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { OutputEntry } from '../../src/core/export/index.js';
import type { MediaProperties } from '../../src/core/specs/index.js';

/** A manifest entry; override what a test needs. */
export function outputEntryFactory(overrides: Partial<OutputEntry> & Pick<OutputEntry, 'specId' | 'path'>): OutputEntry {
  return { order: 1, name: 'shot', fallbackInput: false, ...overrides };
}

/** n localized screenshot entries for one spec and locale, e.g. `apple/de-DE/iphone-6.3/01-shot-1.png`. */
export function screenshotEntries(specId: string, locale: OutputEntry['locale'], count: number): OutputEntry[] {
  const segment = specId.split('.').slice(2).join('.');
  const target = specId.split('.')[0] ?? '';
  return Array.from({ length: count }, (_, index) => {
    const order = index + 1;
    const nn = String(order).padStart(2, '0');
    return outputEntryFactory({
      specId,
      ...(locale ? { locale } : {}),
      order,
      name: `shot-${order}`,
      path: `${target}/${locale}/${segment}/${nn}-shot-${order}.png`,
    });
  });
}

/** A measure function that returns fixed properties per output path (default: the given fallback). */
export function measureFactory(byPath: Record<string, Partial<MediaProperties>>, fallback: MediaProperties) {
  return async (absolutePath: string): Promise<MediaProperties> => {
    const key = Object.keys(byPath).find((p) => absolutePath.replace(/\\/g, '/').endsWith(p));
    if (key && byPath[key]?.bytes === -1) {
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    }
    return { ...fallback, ...(key ? byPath[key] : {}) };
  };
}

/** A temporary exports folder with a `prepared/` root and a ZIP stand-in of the given names waiting in `folder`. */
export function preparedFoldersFactory(): { exportsDir: string; pendingRoot: string; zip: (folder: string, name: string) => string } {
  const exportsDir = tempDir('amc-exports-');
  const pendingRoot = path.join(exportsDir, 'prepared');
  return {
    exportsDir,
    pendingRoot,
    zip: (folder, name) => {
      mkdirSync(folder, { recursive: true });
      const file = path.join(folder, name);
      writeFileSync(file, 'zip');
      return file;
    },
  };
}
