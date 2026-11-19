// conventions: RULE-TESTING-3301
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { viewportWidths } from '../factories/web.js';
import { projectInputFactory } from '../factories/workspace.js';

/** German and Turkish, both stores. */
function textProject() {
  return { ...projectInputFactory(), sourceLocale: 'de-DE', locales: ['de-DE', 'tr-TR'] };
}

/** The fieldset of one store inside the card of one language. */
function store(page: Page, language: string, storeName: string) {
  return page.getByRole('region', { name: language }).getByRole('group', { name: storeName });
}

test.describe('The Store texts section', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    expect((await request.put('/api/project', { data: textProject() })).ok()).toBe(true);
    const current = (await (await request.get('/api/store-texts')).json()) as { revision: number };
    expect((await request.put('/api/store-texts', { data: { version: 1, revision: current.revision, texts: {} } })).ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    const current = (await (await request.get('/api/store-texts')).json()) as { revision: number };
    await request.put('/api/store-texts', { data: { version: 1, revision: current.revision, texts: {} } });
    await request.put('/api/project', { data: projectInputFactory() });
  });

  test('counts characters and bytes, saves automatically and shows the store checks', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/store-texts');
    await expect(page.getByRole('heading', { level: 1, name: 'Store texts' })).toBeVisible();

    const subtitle = store(page, 'German', 'Apple App Store').getByLabel('Subtitle');
    await subtitle.fill('Faire Teams in Sekunden für alle');
    await expect(store(page, 'German', 'Apple App Store').getByText(/^32 \/ 30 characters/)).toBeVisible();
    await expect(subtitle).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Changes saved.')).toBeVisible();
    await expect(store(page, 'German', 'Apple App Store').getByText('Error: Subtitle has 32 characters; the store allows 30')).toBeVisible();

    // Turkish letters take two bytes in the App Store keywords.
    await store(page, 'Turkish', 'Apple App Store').getByLabel('Keywords').fill('ş'.repeat(51));
    await expect(store(page, 'Turkish', 'Apple App Store').getByText(/^102 \/ 100 bytes/)).toBeVisible();
    await store(page, 'German', 'Google Play').getByLabel('Short description').fill('Faire Teams für dein Spiel');
    await expect(store(page, 'German', 'Google Play').getByText('26 / 80 characters')).toBeVisible();
    await expect(page.getByText('Changes saved.')).toBeVisible();

    await page.reload();
    await expect(store(page, 'German', 'Google Play').getByLabel('Short description')).toHaveValue('Faire Teams für dein Spiel');
    await expect(store(page, 'Turkish', 'Apple App Store').getByLabel('Keywords')).toHaveValue('ş'.repeat(51));
  });

  test('prepares an AI job, shows its texts and applies them after a confirmation', async ({ page, request }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/store-texts');
    await page.getByRole('button', { name: 'Prepare AI job' }).click();
    await expect(page.getByText(/\/amc-store-texts "/)).toBeVisible();

    // Play the part of the skill: write the German App Store description into the job folder.
    const [job] = (await (await request.get('/api/jobs?task=store-texts&limit=1')).json()) as { folder: string }[];
    mkdirSync(path.join(job!.folder, 'store-texts', 'de-DE'), { recursive: true });
    writeFileSync(path.join(job!.folder, 'store-texts', 'de-DE', 'apple-description.md'), 'Teile Spieler nach Stärke in zwei faire Teams.');
    await expect(page.getByText('Store texts are ready')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { level: 4, name: 'German' })).toBeVisible();

    await page.getByRole('button', { name: 'Apply texts' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Replaces the fields the AI wrote for German.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Apply texts' }).click();
    await expect(page.getByText('AI texts applied for German.')).toBeVisible();
    await expect(store(page, 'German', 'Apple App Store').getByLabel('Description')).toHaveValue('Teile Spieler nach Stärke in zwei faire Teams.');
    // The texts typed before stay.
    await expect(store(page, 'German', 'Google Play').getByLabel('Short description')).toHaveValue('Faire Teams für dein Spiel');
  });

  for (const width of viewportWidths()) {
    test(`shows the texts at ${width} px without accessibility violations`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/#/store-texts');
      await expect(page.getByRole('heading', { level: 3, name: 'German' })).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `test-results/screenshots/store-texts-${width}.png`, fullPage: true });
    });
  }
});
