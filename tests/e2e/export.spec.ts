// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { registerOutput } from '../../src/core/export/index.js';
import { openWorkspace } from '../../src/core/workspace/index.js';
import { viewportWidths } from '../factories/web.js';
import { pngBytes, projectInputFactory } from '../factories/workspace.js';

// Same folder the Playwright web server starts the CLI with (playwright.config.ts).
const WORKSPACE = 'test-results/e2e-workspace';

/** Keeps only German in the locale bar of the current section by deselecting the other five languages. */
async function selectGermanOnly(page: Page) {
  const bar = page.getByRole('group', { name: /Languages for this section/ });
  for (const name of ['English (US)', 'Spanish', 'Italian', 'French', 'Turkish']) {
    await bar.locator('label', { hasText: name }).click();
  }
  await expect(bar.getByRole('checkbox', { checked: true })).toHaveCount(1);
}

test.describe('The export of the running tool', () => {
  // One worker seeds the shared workspace; parallel workers would race on output/manifest.json.
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    // The tests need the default project: all 6 languages and every store enabled.
    expect((await request.put('/api/project', { data: projectInputFactory() })).ok()).toBe(true);
    const workspace = await openWorkspace(WORKSPACE);
    await registerOutput(workspace, { specId: 'apple.icon', order: 1, name: 'app-icon', extension: 'png', bytes: await pngBytes(1024, 1024) });
    const shot = await pngBytes(1206, 2622);
    for (const locale of ['de-DE', 'tr-TR']) {
      await registerOutput(workspace, { specId: 'apple.screenshot.iphone-6.3', locale, order: 1, name: 'start', extension: 'png', bytes: shot });
    }
  });

  test('downloads a ZIP for de-DE with the store folder layout through the API', async ({ request }) => {
    const response = await request.post('/api/export', { data: { locales: ['de-DE'] } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toBe('application/zip');
    const names = Object.keys(unzipSync(new Uint8Array(await response.body())));
    expect(names).toEqual(
      expect.arrayContaining(['CHECKLIST.md', 'apple/de-DE/iphone-6.3/01-start.png', 'apple/shared/icon/app-icon.png']),
    );
    expect(names.some((name) => name.includes('/tr-TR/'))).toBe(false);
  });

  test('reports the valid de-DE screenshot set as ok in the checklist API', async ({ request }) => {
    const response = await request.get('/api/export/checklist?locales=de-DE');
    const checklist = (await response.json()) as { targets: { items: { specId: string; locale?: string; status: string }[] }[] };
    const item = checklist.targets.flatMap((t) => t.items).find((i) => i.specId === 'apple.screenshot.iphone-6.3' && i.locale === 'de-DE');
    expect(item?.status).toBe('ok');
  });

  test('rejects an export for an unsupported locale', async ({ request }) => {
    const response = await request.post('/api/export', { data: { locales: ['pt-BR'] } });
    expect(response.status()).toBe(400);
  });

  test('shows the checklist per store for the selected language', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/export');
    await selectGermanOnly(page);

    const apple = page.getByRole('region', { name: 'Apple App Store' });
    await apple.getByText(/assets? OK/).click();
    const languages = apple.getByRole('list', { name: 'Languages of iPhone 6.3" (Dynamic Island medium)' });
    await expect(languages.getByRole('listitem')).toHaveCount(1);
    await expect(languages.getByRole('listitem')).toContainText('German');
    await expect(languages.getByRole('listitem')).toContainText('OK');
    await expect(apple).not.toContainText('Turkish');

    const google = page.getByRole('region', { name: 'Google Play' });
    const playIcon = google.getByRole('listitem').filter({ hasText: 'Google Play app icon' }).first();
    await expect(playIcon).toContainText('Error');
    await expect(playIcon).toContainText('required but missing');
  });

  test('asks before downloading an incomplete ZIP and downloads nothing on Cancel', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    await page.goto('/#/export');
    await expect(page.getByText('Required files are missing or invalid.')).toBeVisible();
    const button = page.getByRole('button', { name: 'Download ZIP' });
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Download with errors?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
    expect(downloads).toBe(0);
  });

  test('closes the confirmation with Escape and returns focus to the Download button', async ({ page }) => {
    await page.goto('/#/export');
    const button = page.getByRole('button', { name: 'Download ZIP' });
    await button.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(button).toBeFocused();
  });

  test('downloads the ZIP for the selected language after confirming', async ({ page }) => {
    await page.goto('/#/export');
    await selectGermanOnly(page);
    await expect(page.getByText('Required files are missing or invalid.')).toBeVisible();
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', { name: 'Download anyway' }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    const names = Object.keys(unzipSync(new Uint8Array(readFileSync(await download.path()))));
    expect(names).toEqual(expect.arrayContaining(['CHECKLIST.md', 'apple/de-DE/iphone-6.3/01-start.png']));
    expect(names.some((name) => name.includes('/tr-TR/'))).toBe(false);
    await expect(page.getByRole('status').filter({ hasText: 'downloaded' })).toBeVisible();
  });

  test('drops a running download when the languages change and lets a new one start (#48)', async ({ page }) => {
    let downloads = 0;
    page.on('download', () => (downloads += 1));
    let requests = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Hold the first export request back until the selection has changed, then let it through.
    await page.route('**/api/export', async (route) => {
      requests += 1;
      if (requests === 1) await gate;
      await route.continue().catch(() => undefined);
    });

    await page.goto('/#/export');
    await selectGermanOnly(page);
    await expect(page.getByText('Required files are missing or invalid.')).toBeVisible();
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Download anyway' }).click();
    const busy = page.getByRole('button', { name: 'Building ZIP…' });
    await expect(busy).toBeVisible();
    // Clicks on the busy button start nothing.
    await busy.click({ force: true });
    await expect.poll(() => requests).toBe(1);

    // Changing the languages aborts the held request in the browser.
    const aborted = page.waitForEvent('requestfailed', (request) => request.url().endsWith('/api/export'));
    await page.getByRole('group', { name: /Languages for this section/ }).locator('label', { hasText: 'Turkish' }).click();
    await aborted;
    release();
    const button = page.getByRole('button', { name: 'Download ZIP' });
    await expect(button).toBeVisible();
    expect(downloads).toBe(0);
    await expect(page.getByRole('status').filter({ hasText: 'downloaded' })).toHaveCount(0);
    await expect(page.getByRole('alert').filter({ hasText: 'could not' })).toHaveCount(0);

    // The slot is free again: a new download for the new selection sends a new request.
    await button.click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('dialog').getByRole('button', { name: 'Download anyway' }).click();
    await downloading;
    expect(requests).toBe(2);
    await expect(page.getByRole('status').filter({ hasText: 'downloaded' })).toBeVisible();
  });

  for (const width of viewportWidths()) {
    test(`shows the Export section with data at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/export');
      await expect(page.getByRole('region', { name: 'Apple App Store' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/export-data-${width}.png`, fullPage: true });
    });
  }
});
