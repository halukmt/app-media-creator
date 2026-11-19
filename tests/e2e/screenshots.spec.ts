// conventions: RULE-TESTING-3301
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
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

    // Purpose: store screenshots with headline (the default).
    await page.getByRole('button', { name: 'Purpose', exact: false }).first().click();
    await expect(page.getByRole('radio', { name: /Store screenshots with headline/ })).toBeChecked();
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
    await page.getByRole('link', { name: 'Open Export section' }).click();
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

  test('prepares an AI job, shows the result live and applies variant B to the headlines (#15)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/screenshots');
    await page.getByRole('button', { name: /Preview and edit/ }).first().click();
    await page.getByRole('button', { name: 'Prepare AI job' }).click();
    await expect(page.getByText('Run this in Claude Code')).toBeVisible();
    await expect(page.getByText(/\/amc-copy "/)).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Waiting for Claude Code…' })).toBeVisible();

    // Play the part of the skill: write headlines.json for German into the job folder.
    const [job] = (await (await request.get('/api/jobs')).json()) as { folder: string }[];
    const brief = JSON.parse(readFileSync(path.join(job!.folder, 'brief.json'), 'utf8')) as { screenshots: Record<string, { input: string }[]> };
    const slots = brief.screenshots['de-DE']!.map((slot, index) => ({
      input: slot.input,
      A: { headline: `Ergebnis ${index + 1}`, subline: '' },
      B: { headline: `Mechanismus ${index + 1}`, subline: 'Mit einem Tipp' },
    }));
    writeFileSync(path.join(job!.folder, 'headlines.json'), JSON.stringify({ version: 1, locales: { 'de-DE': { slots } } }));

    await expect(page.getByRole('status').filter({ hasText: 'Headlines are ready' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('region', { name: 'German' }).getByText('Mechanismus 1')).toBeVisible();
    await page.getByRole('button', { name: 'Apply variant B' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Apply variant B' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Variant B applied for German.' })).toBeVisible();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    await expect(page.getByLabel('Headline', { exact: true }).first()).toHaveValue('Mechanismus 1');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });

  test('keeps edits blocked after an apply whose reload failed, until a later reload shows the applied texts (#87)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/screenshots');
    await page.getByRole('button', { name: /Preview and edit/ }).first().click();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    const headline = page.getByLabel('Headline', { exact: true }).first();
    await expect(headline).toHaveValue('Mechanismus 1');

    // The reload right after the apply fails once.
    let failNext = true;
    await page.route('**/api/screenshots', async (route) => {
      if (route.request().method() === 'GET' && failNext) {
        failNext = false;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary failure' }) });
      } else await route.continue();
    });
    await page.getByRole('button', { name: 'Apply variant A' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Apply variant A' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'The screenshots could not be loaded.' })).toBeVisible();

    // The page still shows the old text and refuses edits, so nothing can save it over the applied one.
    await headline.fill('Old text typed now');
    await expect(headline).toHaveValue('Mechanismus 1');
    await expect(page.getByText('Changes are paused until the applied headlines are loaded.')).toBeVisible();
    // The server keeps the applied text.
    const stored = (await (await page.request.get('/api/screenshots')).json()) as { sets: Record<string, { headline: string }[]> };
    expect(stored.sets['de-DE']?.[0]?.headline).toBe('Ergebnis 1');

    // Recovery through another reload than "Try again": an upload reloads the sets and clears the error.
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await uploadFor(page, 'German', 'third.png');
    await expect(page.getByRole('alert').filter({ hasText: 'The screenshots could not be loaded.' })).toHaveCount(0);
    await page.getByRole('button', { name: /Preview and edit/ }).first().click();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    await expect(headline).toHaveValue('Ergebnis 1');
    await expect(page.getByText('Changes are paused until the applied headlines are loaded.')).toHaveCount(0);
    await headline.fill('Ergebnis eins');
    await expect(headline).toHaveValue('Ergebnis eins');
  });

  test('leaves the apply buttons usable when saving pending edits fails before an apply (#89)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/screenshots');
    await page.getByRole('button', { name: /Preview and edit/ }).first().click();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'German' }).click();
    let applyRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/api\/jobs\/[^/]+\/apply$/.test(request.url())) applyRequests += 1;
    });
    // Saves of the sets fail while this route is set.
    await page.route('**/api/screenshots', async (route) => {
      if (route.request().method() === 'PUT') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Disk full' }) });
      else await route.continue();
    });
    try {
      const headline = page.getByLabel('Headline', { exact: true }).first();
      await headline.fill('Pending edit');
      await page.getByRole('button', { name: 'Apply variant B' }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Apply variant B' }).click();
      await expect(page.getByRole('alert').filter({ hasText: 'Your latest changes could not be saved' }).first()).toBeVisible();
      // Nothing was applied: no request, the dialog is closed, no paused note, both buttons ready, edits taken.
      expect(applyRequests).toBe(0);
      await expect(page.getByRole('dialog')).toBeHidden();
      await expect(page.getByText('Changes are paused until the applied headlines are loaded.')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Apply variant A' })).not.toHaveAttribute('aria-disabled', 'true');
      await expect(page.getByRole('button', { name: 'Apply variant B' })).not.toHaveAttribute('aria-disabled', 'true');
      await headline.fill('Still editable');
      await expect(headline).toHaveValue('Still editable');
    } finally {
      await page.unroute('**/api/screenshots');
    }
  });

  /** Opens the purpose step and picks the App Store header and search images. */
  async function chooseHeader(page: Page) {
    await page.goto('/#/screenshots');
    await page.getByRole('button', { name: 'Purpose', exact: false }).first().click();
    await page.getByRole('group', { name: /What are the screenshots for/ }).locator('label', { hasText: 'Product page header' }).click();
  }

  test('creates the App Store header, search and universal images with a phrase and shows their safe area (#18)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await chooseHeader(page);
    await page.getByLabel('Phrase (German)').fill('Faire Teams in Sekunden');
    await page.getByLabel('Phrase (Turkish)').fill('Saniyeler içinde adil takımlar');
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.getByRole('button', { name: /Preview and edit →/ }).click();
    await page.getByRole('group', { name: /Language to edit/ }).locator('label', { hasText: 'Turkish' }).click();
    for (const name of ['Product page header', 'Search results', 'Universal (header and search)']) {
      await expect(page.getByRole('img', { name: `Preview of ${name}, Turkish` })).toBeVisible();
    }
    await expect(page.getByText('3840 × 1646 px · safe area 1646 × 661 px')).toBeVisible();
    await expect(page.getByTestId('preview-guide')).toHaveCount(3);
    await page.getByRole('switch', { name: 'Show safe area' }).uncheck();
    await expect(page.getByTestId('preview-guide')).toHaveCount(0);

    await page.getByRole('button', { name: /Export →/ }).click();
    await page.getByRole('button', { name: 'Generate header and search images' }).click();
    await expect(page.getByText(/files generated/)).toBeVisible({ timeout: 60_000 });
    const paths = ((await (await request.get('/api/output')).json()) as { path: string }[]).map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'apple/de-DE/creative-header-image/01-header.png',
        'apple/tr-TR/creative-search-image/01-search.png',
        'apple/tr-TR/creative-universal-image/01-universal.png',
      ]),
    );
  });

  test('creates the Play feature graphic with the phrase and the in-app event images without text (#19)', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/screenshots');
    await page.getByRole('button', { name: 'Purpose', exact: false }).first().click();
    await page.getByRole('group', { name: /What are the screenshots for/ }).locator('label', { hasText: 'Feature graphic and in-app event images' }).click();
    // Background and phrases are shared with the header images.
    await expect(page.getByLabel('Phrase (German)')).toHaveValue('Faire Teams in Sekunden');
    await page.getByRole('button', { name: /Preview and edit →/ }).click();
    for (const name of ['Feature graphic (Google Play)', 'In-app event card', 'In-app event details']) {
      await expect(page.getByRole('img', { name: `Preview of ${name}, German` })).toBeVisible();
    }
    await expect(page.getByText('1024 × 500 px · key area')).toBeVisible();

    await page.getByRole('button', { name: /Export →/ }).click();
    await page.getByRole('button', { name: 'Generate feature graphic and event images' }).click();
    await expect(page.getByText(/files generated/)).toBeVisible({ timeout: 60_000 });
    const entries = (await (await request.get('/api/output')).json()) as { specId: string; locale?: string }[];
    for (const specId of ['google.feature-graphic', 'apple.event.card-image', 'apple.event.details-image']) {
      expect(entries.filter((e) => e.specId === specId).map((e) => e.locale).sort(), specId).toEqual(['de-DE', 'tr-TR']);
    }
  });

  for (const width of viewportWidths()) {
    test(`shows the header image preview at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await chooseHeader(page);
      await page.getByRole('button', { name: /Preview and edit →/ }).click();
      await expect(page.getByRole('img', { name: /^Preview of Universal/ })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/screenshots-header-${width}.png`, fullPage: true });
    });
  }

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
