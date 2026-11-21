// conventions: RULE-TESTING-3301
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { viewportWidths } from '../factories/web.js';
import { projectInputFactory, svgBytes } from '../factories/workspace.js';

/** German and Turkish only, so the share images stay few; one preview environment for the icon variants. */
function smallProject() {
  return {
    ...projectInputFactory(),
    sourceLocale: 'de-DE',
    locales: ['de-DE', 'tr-TR'],
    environments: [{ id: 'preview', badge: 'PREVIEW', color: 'orange', style: 'badge' }],
  };
}

test.describe('The Logo section', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    expect((await request.put('/api/project', { data: smallProject() })).ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.put('/api/project', { data: projectInputFactory() });
  });

  test('uploads a logo, sets options, generates all packs and exports them per target', async ({ page }) => {
    // Renders every logo pack; under load this takes longer than the default 30 s.
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/logo');
    await expect(page.getByRole('heading', { level: 1, name: 'Logo' })).toBeVisible();

    await page.getByLabel('Logo', { exact: true }).setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svgBytes()) });
    await expect(page.getByText('Logo uploaded.')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Your current logo' })).toBeVisible();
    // An SVG logo scales without loss: no size warning on the current-logo card (#64).
    await expect(page.getByText('SVG (vector, scales without loss)')).toBeVisible();

    await page.getByRole('button', { name: /Options →/ }).click();
    await page.getByRole('group', { name: /Background colour/ }).locator('label', { hasText: 'Navy' }).click();
    await page.getByLabel('Tagline (German)').fill('Faire Teams in Sekunden');
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.getByRole('button', { name: /Preview →/ }).click();
    await page.getByRole('button', { name: /^Generate [0-9]+ packs?$/ }).click();
    await expect(page.getByText(/files generated/)).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('img', { name: 'Preview of App Store icon' }).first()).toBeVisible();
    // The labelled icons of the preview environment are a second icon set.
    await page.getByRole('group', { name: /Icon set/ }).locator('label', { hasText: 'PREVIEW' }).click();
    await expect(page.getByRole('img', { name: 'Preview of App Store icon (preview)' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Preview of App Store icon', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /Export →/ }).click();
    await page.getByRole('link', { name: 'Open Export section' }).click();
    // The confirmation appears only while required files of other sections are missing: wait for either outcome.
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download ZIP' }).click();
    const anyway = page.getByRole('dialog').getByRole('button', { name: 'Download anyway' });
    await Promise.race([downloading, anyway.waitFor().then(() => anyway.click()).catch(() => undefined)]);
    const names = Object.keys(unzipSync(new Uint8Array(readFileSync(await (await downloading).path()))));
    // Files per target.
    expect(names).toEqual(
      expect.arrayContaining([
        'apple/shared/icon/app-icon.png',
        'google/shared/icon/play-icon.png',
        'web/shared/favicons/favicon.ico',
        'web/de-DE/og-image/01-og-image.png',
        'web/tr-TR/whatsapp-preview/01-whatsapp-preview.jpg',
        // Icon variants of the preview environment.
        'apple/preview/icon/app-icon.png',
        'google/preview/android-res/mipmap-xxxhdpi/ic_launcher.png',
        'web/preview/favicons/favicon.ico',
      ]),
    );
  });

  test('shows no icon set filter once the project has no environments (#70)', async ({ page, request }) => {
    expect((await request.put('/api/project', { data: { ...smallProject(), environments: [] } })).ok()).toBe(true);
    // Generating again removes the icon sets of the removed environment.
    for (const pack of ['web-icons', 'app-store-icons', 'android-icons']) {
      expect((await request.post(`/api/generate/${pack}`, { data: {} })).ok(), pack).toBe(true);
    }
    await page.goto('/#/logo');
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await expect(page.getByRole('img', { name: 'Preview of App Store icon', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: /Icon set/ })).toHaveCount(0);
    await expect(page.getByRole('img', { name: /\(preview\)$/ })).toHaveCount(0);
  });

  for (const width of viewportWidths()) {
    test(`shows the preview step at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/logo');
      await page.getByRole('button', { name: 'Preview', exact: true }).click();
      await expect(page.getByRole('heading', { level: 3, name: 'App Store icons' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/logo-preview-${width}.png`, fullPage: true });
    });
  }
});
