// conventions: RULE-TESTING-3301
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('The start screen of the local UI', () => {
  test('opens the Project section and shows the connected server', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Project' })).toBeVisible();
    await expect(page.getByTestId('server-status')).toContainText('connected');
  });

  test('has no serious or critical accessibility violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking).toEqual([]);
  });

  test('falls back to the UI for an unknown page route', async ({ page }) => {
    await page.goto('/does-not-exist');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
