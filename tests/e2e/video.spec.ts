// conventions: RULE-TESTING-3301
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { writePromoVideo } from '../factories/promo.js';
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
    await expect(purposes.getByRole('radio', { name: /Promo reel/ })).toBeEnabled();
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

  test('prepares a promo reel job for Claude Code and adds the rendered 16:9 reel to the outputs (#22)', async ({ page, request }) => {
    test.slow();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/video');
    await page.getByRole('button', { name: /Purpose →/ }).click();
    await page.getByRole('group', { name: 'What are the videos for?' }).locator('label', { hasText: 'Promo reel' }).click();
    await page.getByRole('button', { name: /Options →/ }).click();
    // Only 16:9: one render keeps the test short.
    const formats = page.getByRole('group', { name: 'Formats of the promo reel' });
    await formats.locator('label', { hasText: '9:16' }).click();
    await formats.locator('label', { hasText: '1:1' }).click();
    await page.getByLabel('Website of the app (optional)').fill('example.com');
    await expect(page.getByText('Enter an address that starts with https:// or http://.')).toBeVisible();
    await page.getByLabel('Website of the app (optional)').fill('https://example.com');
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.getByRole('button', { name: /Export →/ }).click();
    await expect(page.getByText(/upload the 16:9 reel to YouTube/)).toBeVisible();
    await page.getByRole('button', { name: 'Prepare AI job' }).click();
    await expect(page.getByText(/^\/amc-video "/)).toBeVisible();

    // Play the part of the skill: save a finished 16:9 render into the job folder.
    const [job] = (await (await request.get('/api/jobs?task=promo-video&limit=1')).json()) as { folder: string }[];
    writePromoVideo(job!.folder, 'de-DE', 'landscape.mp4', recordingBytes({ seconds: 11, width: 1920, height: 1080, fps: 10 }));
    await expect(page.getByText('Promo reels are ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1920 × 1080 px · 11 s')).toBeVisible();

    await page.getByRole('button', { name: 'Add reels to outputs' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Replaces the earlier promo reels for German.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Add reels to outputs' }).click();
    await expect(page.getByText('Promo reels added for German.')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ has: page.getByText('Promo reel 16:9') }).locator('video')).toBeVisible();
    await expect(page.getByRole('listitem').filter({ has: page.getByText('Promo video for YouTube (Google Play)') })).toBeVisible();

    // Back to the App Store preview for the screenshot tests below.
    await openStep(page, 'Purpose');
    await page.getByRole('group', { name: 'What are the videos for?' }).locator('label', { hasText: 'App Store preview' }).click();
    await expect(page.getByText('Changes saved.')).toBeVisible();
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
