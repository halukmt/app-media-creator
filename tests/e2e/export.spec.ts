// conventions: RULE-TESTING-3301
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { registerOutput } from '../../src/core/export/index.js';
import { openWorkspace } from '../../src/core/workspace/index.js';

// Same folder the Playwright web server starts the CLI with (playwright.config.ts).
const WORKSPACE = 'test-results/e2e-workspace';

async function png(width: number, height: number): Promise<Uint8Array> {
  return Uint8Array.from(await sharp({ create: { width, height, channels: 3, background: '#2255aa' } }).png().toBuffer());
}

test.describe('The export API of the running tool', () => {
  // One worker seeds the shared workspace; parallel workers would race on output/manifest.json.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    const workspace = await openWorkspace(WORKSPACE);
    await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await png(1024, 1024) });
    const shot = await png(1206, 2622);
    for (const locale of ['de-DE', 'tr-TR']) {
      await registerOutput(workspace, { specId: 'apple.screenshot.iphone-6.3', locale, order: 1, name: 'start', extension: 'png', bytes: shot });
    }
  });

  test('downloads a ZIP for de-DE with the store folder layout', async ({ request }) => {
    const response = await request.post('/api/export', { data: { locales: ['de-DE'] } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/zip');
    const names = Object.keys(unzipSync(new Uint8Array(await response.body())));
    expect(names).toEqual(
      expect.arrayContaining(['CHECKLIST.md', 'apple/de-DE/iphone-6.3/01-start.png', 'apple/shared/icon/app-icon.png']),
    );
    expect(names.some((name) => name.includes('/tr-TR/'))).toBe(false);
  });

  test('reports the valid de-DE screenshot set as ok in the checklist', async ({ request }) => {
    const response = await request.get('/api/export/checklist?locales=de-DE');
    const checklist = (await response.json()) as { targets: { items: { specId: string; locale?: string; status: string }[] }[] };
    const item = checklist.targets.flatMap((t) => t.items).find((i) => i.specId === 'apple.screenshot.iphone-6.3' && i.locale === 'de-DE');
    expect(item?.status).toBe('ok');
  });

  test('rejects an export for an unsupported locale', async ({ request }) => {
    const response = await request.post('/api/export', { data: { locales: ['pt-BR'] } });
    expect(response.status()).toBe(400);
  });
});
