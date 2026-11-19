// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { appScreenshot } from '../factories/screenshots.js';
import { viewportWidths } from '../factories/web.js';
import { projectInputFactory } from '../factories/workspace.js';

/** German source, German and Turkish, one Apple and one Play device: a small project that renders fast. */
function smallProject() {
  return {
    ...projectInputFactory(),
    sourceLocale: 'de-DE',
    locales: ['de-DE', 'tr-TR'],
    targets: {
      apple: { enabled: true, devices: ['apple.screenshot.iphone-6.3'] },
      google: { enabled: true, devices: ['google.screenshot.phone'] },
      web: { enabled: true, devices: [] },
    },
  };
}

async function uploadFor(page: Page, language: string, name: string) {
  await page.getByRole('group', { name: /Language of the screenshots/ }).locator('label', { hasText: language }).click();
  await page.getByLabel('Screenshots', { exact: true }).setInputFiles({ name, mimeType: 'image/png', buffer: Buffer.from(await appScreenshot(236, 512)) });
  await expect(page.getByText(/screenshot uploaded/)).toBeVisible();
}

test.describe('The Screenshots section', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    expect((await request.put('/api/project', { data: smallProject() })).ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.put('/api/project', { data: projectInputFactory() });
  });

  test('uploads for two languages, edits a headline, previews and generates, and the ZIP holds both languages', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/screenshots');
    await expect(page.getByRole('heading', { level: 1, name: 'Screenshots' })).toBeVisible();

    await uploadFor(page, 'German', 'start.png');
    await uploadFor(page, 'Turkish', 'baslangic.png');

    // Purpose: store screenshots with headline (the default); the later purposes are disabled.
    await page.getByRole('button', { name: 'Purpose', exact: false }).first().click();
    await expect(page.getByRole('radio', { name: /Feature graphic/ })).toBeDisabled();
    await page.getByRole('button', { name: /Preview and edit →/ }).click();

    // Edit the German headline and see the preview.
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    await page.getByLabel('Headline', { exact: true }).first().fill('Faire Teams in Sekunden');
    await expect(page.getByText('Changes saved.')).toBeVisible();
    await expect(page.getByRole('img', { name: /Preview of screenshot 1 on/ })).toBeVisible();

    // Generate both languages.
    await page.getByRole('button', { name: /Export →/ }).click();
    await page.getByRole('button', { name: 'Generate screenshots' }).click();
    await expect(page.getByText(/files generated/)).toBeVisible({ timeout: 60_000 });

    // Export: download the ZIP for both languages.
    await page.getByRole('link', { name: 'Go to Export' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Export' })).toBeVisible();
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const downloading = page.waitForEvent('download');
    const dialog = page.getByRole('dialog');
    if (await dialog.isVisible()) await dialog.getByRole('button', { name: 'Download anyway' }).click();
    const download = await downloading;
    const names = Object.keys(unzipSync(new Uint8Array(readFileSync(await download.path()))));
    expect(names).toEqual(
      expect.arrayContaining(['apple/de-DE/iphone-6.3/01-start.png', 'apple/tr-TR/iphone-6.3/01-baslangic.png', 'google/de-DE/phone/01-start.png']),
    );
  });

  test('keeps the headline with its screenshot when the order changes, by keyboard', async ({ page }) => {
    await page.goto('/#/screenshots');
    await uploadFor(page, 'German', 'second.png');
    await page.getByRole('button', { name: /Preview and edit/ }).first().click();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    const down = page.getByRole('button', { name: 'Move screenshot 1 down' });
    await down.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Moved to position 2 of 2.' })).toBeVisible();
    await expect(page.getByLabel('Headline', { exact: true }).nth(1)).toHaveValue('Faire Teams in Sekunden');
  });

  for (const width of viewportWidths()) {
    test(`shows the preview step at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/screenshots');
      await page.getByRole('button', { name: /Preview and edit/ }).first().click();
      await expect(page.getByRole('img', { name: /Preview of screenshot 1 on/ })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/screenshots-preview-${width}.png`, fullPage: true });
    });
  }
});
