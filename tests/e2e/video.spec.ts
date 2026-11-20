// conventions: RULE-TESTING-3301
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { recordingBytes } from '../factories/video.js';
import { viewportWidths } from '../factories/web.js';
import { projectInputFactory } from '../factories/workspace.js';

/** German only, App Store and web on: one render keeps the test short. */
function videoProject() {
  return { ...projectInputFactory(), sourceLocale: 'de-DE', locales: ['de-DE'] };
}

async function openStep(page: Page, name: string | RegExp) {
  await page.getByRole('navigation', { name: 'Section steps' }).getByRole('button', { name }).click();
}

test.describe('The Video section', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    expect((await request.put('/api/project', { data: videoProject() })).ok()).toBe(true);
    // A 16 s stand-in recording: long enough for a 15–30 s App Store preview.
    const upload = await request.post('/api/inputs/video', {
      multipart: { locale: 'de-DE', file: { name: 'teams.mp4', mimeType: 'video/mp4', buffer: Buffer.from(recordingBytes({ seconds: 16 })) } },
    });
    expect(upload.ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.put('/api/project', { data: projectInputFactory() });
  });

  test('shows the recording, saves the options and makes a valid App Store preview with a German text card', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/video');
    await expect(page.getByRole('heading', { level: 1, name: 'Video' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'Recordings' })).toBeVisible();
    await expect(page.getByText('teams.mp4')).toBeVisible();

    await page.getByRole('button', { name: /Purpose →/ }).click();
    const purposes = page.getByRole('group', { name: 'What are the videos for?' });
    await expect(purposes.getByRole('radio', { name: /Promo reel/ })).toBeDisabled();
    await purposes.locator('label', { hasText: 'App Store preview' }).click();

    await page.getByRole('button', { name: /Options →/ }).click();
    await page.getByLabel('Trim start (seconds)').fill('abc');
    await expect(page.getByText('Enter seconds as a number from 0, e.g. 2.5.')).toBeVisible();
    await page.getByLabel('Trim start (seconds)').fill('');
    await page.getByRole('region', { name: 'Text card before the recording' }).getByLabel('Card text (German)').fill('Faire Teams in Sekunden');
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.reload();
    await openStep(page, 'Options');
    await expect(page.getByRole('region', { name: 'Text card before the recording' }).getByLabel('Card text (German)')).toHaveValue('Faire Teams in Sekunden');

    await page.getByRole('button', { name: /Export →/ }).click();
    await page.getByRole('button', { name: 'Make App Store previews' }).click();
    await expect(page.getByText(/videos? made/)).toBeVisible({ timeout: 150_000 });
    const card = page.getByRole('listitem').filter({ has: page.getByText('App Store preview, iPhone') });
    await expect(card.locator('video')).toHaveAttribute('aria-label', 'App Store preview, iPhone, German');
    await expect(card.getByText('OK')).toBeVisible();
    // The size comes from the video file itself (#111).
    await expect(card.getByText('German · 886 × 1920 px')).toBeVisible();
  });

  for (const width of viewportWidths()) {
    test(`shows the generated videos at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/video');
      await openStep(page, 'Export');
      await expect(page.getByText('App Store preview, iPhone')).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/video-${width}.png`, fullPage: true });
    });
  }
});
