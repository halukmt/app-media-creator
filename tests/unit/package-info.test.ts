// conventions: RULE-TESTING-3301
import { tempDir } from '../factories/temp.js';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { readPackageInfo } from '../../src/core/package-info.js';

describe('readPackageInfo reads name and version from package.json', () => {
  test('returns name and version of the repository package', () => {
    const info = readPackageInfo(path.resolve('package.json'));
    expect(info.name).toBe('app-media-creator');
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('throws when the file does not exist', () => {
    expect(() => readPackageInfo('missing/package.json')).toThrow('package.json not found');
  });

  test('throws when the version is missing', () => {
    const dir = tempDir('amc-');
    const file = path.join(dir, 'package.json');
    writeFileSync(file, JSON.stringify({ name: 'x' }));
    expect(() => readPackageInfo(file)).toThrow('has no name or version');
  });
});
