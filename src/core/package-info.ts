import { readFileSync } from 'node:fs';

export interface PackageInfo {
  name: string;
  version: string;
}

/**
 * Reads name and version from a package.json file.
 * Throws a descriptive error when the file is missing or lacks the fields.
 */
export function readPackageInfo(packageJsonPath: string): PackageInfo {
  let raw: string;
  try {
    raw = readFileSync(packageJsonPath, 'utf8');
  } catch {
    throw new Error(`package.json not found at ${packageJsonPath}`);
  }
  const data = JSON.parse(raw) as Partial<PackageInfo>;
  if (typeof data.name !== 'string' || typeof data.version !== 'string') {
    throw new Error(`package.json at ${packageJsonPath} has no name or version`);
  }
  return { name: data.name, version: data.version };
}
