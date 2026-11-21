import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * The one folder every unit test writes into (#77), so a developer can exclude it from antivirus scanning
 * (see docs/testing.md). `AMC_TEST_TMP` moves it, e.g. to a drive the scanner skips.
 */
export const TEST_TEMP_ROOT = process.env.AMC_TEST_TMP ?? path.join(tmpdir(), 'app-media-creator-tests');

/** A new, empty folder under the test temp root; `prefix` names what it is for. */
export function tempDir(prefix: string): string {
  mkdirSync(TEST_TEMP_ROOT, { recursive: true });
  return mkdtempSync(path.join(TEST_TEMP_ROOT, prefix));
}
