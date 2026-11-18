// conventions: RULE-TESTING-3301
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { sectionTitles, viewportWidths } from '../factories/web.js';

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

test.describe('The app shell navigates between sections', () => {
  test('marks the chosen section as current and puts it in the address', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await nav.getByRole('link', { name: 'Screenshots' }).click();
    await expect(page).toHaveURL(/#\/screenshots$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Screenshots' })).toBeFocused();
    await expect(nav.getByRole('link', { name: 'Screenshots' })).toHaveAttribute('aria-current', 'page');
  });

  test('opens the section named in the address on reload', async ({ page }) => {
    await page.goto('/#/video');
    await expect(page.getByRole('heading', { level: 1, name: 'Video' })).toBeVisible();
  });

  test('shows the Project section for an unknown section', async ({ page }) => {
    await page.goto('/#/does-not-exist');
    await expect(page.getByRole('heading', { level: 1, name: 'Project' })).toBeVisible();
  });

  test('opens the sections menu from the top bar on a narrow screen and closes it after navigating', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav).toBeHidden();
    const menuButton = page.getByRole('button', { name: 'Open sections menu' });
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await nav.getByRole('link', { name: 'Export' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Export' })).toBeVisible();
    await expect(nav).toBeHidden();
  });

  test('returns focus to the menu button when the menu is closed with Escape', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const menuButton = page.getByRole('button', { name: 'Open sections menu' });
    await menuButton.click();
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
    await expect(menuButton).toBeFocused();
  });

  test('keeps the page usable when the window grows to the wide layout with the menu open', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/#/project');
    await page.getByRole('button', { name: 'Open sections menu' }).click();
    await page.setViewportSize({ width: 1280, height: 900 });
    const name = page.getByLabel('App name');
    await name.click();
    await expect(name).toBeFocused();
    await expect(page.locator('.drawer-content')).not.toHaveAttribute('inert');
  });

  test('explains in each empty section what to upload and which stores need it', async ({ page }) => {
    await page.goto('/#/logo');
    await expect(page.getByRole('heading', { level: 2, name: 'Upload your logo' })).toBeVisible();
    await expect(page.getByText('Needed by')).toBeVisible();
    await expect(page.getByRole('group', { name: /Languages for this section/ })).toBeVisible();
  });

  // One test per section and width keeps each test short and lets them run in parallel.
  for (const width of viewportWidths()) {
    for (const [id, title] of sectionTitles()) {
      test(`shows ${title} at ${width} px without accessibility violations or horizontal scrolling`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/#/${id}`);
        await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
        expect(await blockingViolations(page)).toEqual([]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await page.screenshot({ path: `test-results/screenshots/${id}-${width}.png`, fullPage: true });
      });
    }
  }
});
