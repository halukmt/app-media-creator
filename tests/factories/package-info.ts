import type { PackageInfo } from '../../src/core/package-info.js';

export function packageInfoFactory(overrides: Partial<PackageInfo> = {}): PackageInfo {
  return { name: 'app-media-creator', version: '1.2.3', ...overrides };
}
