// conventions: RULE-TESTING-3301
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { projectInputFactory } from '../factories/workspace.js';

test.describe('The Project screen edits the workspace settings', () => {
  // All tests share the workspace of the running tool; run them one after another and reset the settings.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ request }) => {
    const response = await request.put('/api/project', { data: projectInputFactory() });
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.put('/api/project', { data: projectInputFactory() });
  });

  test('saves a new app name and a disabled store', async ({ page, request }) => {
    await page.goto('/#/project');
    await page.getByLabel('App name').fill('Demo app');
    await page.getByRole('switch', { name: 'Create media for Google Play' }).uncheck();
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();

    const stored = (await (await request.get('/api/project')).json()) as { name: string; targets: { google: { enabled: boolean } } };
    expect(stored.name).toBe('Demo app');
    expect(stored.targets.google.enabled).toBe(false);
  });

  test('keeps unsaved edits when the user visits another section and comes back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/#/project');
    await page.getByLabel('App name').fill('Draft name');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await nav.getByRole('link', { name: 'Logo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Logo' })).toBeVisible();
    await nav.getByRole('link', { name: 'Project' }).click();
    await expect(page.getByLabel('App name')).toHaveValue('Draft name');
    await expect(page.getByText('Unsaved changes')).toBeVisible();
  });

  test('shows the error next to an empty app name and keeps the empty value', async ({ page, request }) => {
    await page.goto('/#/project');
    const name = page.getByLabel('App name');
    await name.fill('');
    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'could not be saved' })).toBeVisible();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toHaveValue('');
    expect(await new AxeBuilder({ page }).analyze().then((r) => r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'))).toEqual([]);

    const stored = (await (await request.get('/api/project')).json()) as { name: string };
    expect(stored.name).toBe('Demo');
  });

  test('stores claims one per line without blank lines', async ({ page, request }) => {
    await page.goto('/#/project');
    await page.getByLabel('Allowed claims').fill('Free to try\n\n  Works offline  ');
    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();

    const stored = (await (await request.get('/api/project')).json()) as { claims: { allowed: string[] } };
    expect(stored.claims.allowed).toEqual(['Free to try', 'Works offline']);
  });

  test('limits the locale bar of a section to the project languages', async ({ page }) => {
    await page.goto('/#/project');
    const languages = page.getByRole('group', { name: /Languages to generate/ });
    // Keep German and Turkish: deselect the other four by clicking their labels, as a user does.
    for (const name of ['English (US)', 'Spanish', 'Italian', 'French']) {
      await languages.locator('label', { hasText: name }).click();
    }
    await expect(languages.getByRole('checkbox', { checked: true })).toHaveCount(2);
    // The source language moved from the deselected English (US) to the first selected language.
    const source = page.getByRole('group', { name: /Source language/ });
    await expect(source.getByRole('radio')).toHaveCount(2);
    await expect(source.getByRole('radio', { name: /^German/ })).toBeChecked();
    await source.locator('label', { hasText: 'Turkish' }).click();
    await expect(source.getByRole('radio', { name: /^Turkish/ })).toBeChecked();
    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Project saved.' })).toBeVisible();

    await page.goto('/#/screenshots');
    const bar = page.getByRole('group', { name: /Languages for this section/ });
    await expect(bar.getByRole('checkbox')).toHaveCount(3);
    await expect(bar.getByRole('checkbox', { name: /^German/ })).toBeChecked();
    await expect(bar.getByRole('checkbox', { name: /^Turkish/ })).toBeChecked();
    await expect(bar.getByRole('checkbox', { name: /^French/ })).toHaveCount(0);
  });

  test('names only enabled stores in an empty state', async ({ page, request }) => {
    const project = projectInputFactory();
    const targets = project.targets as Record<string, { enabled: boolean; devices: string[] }>;
    await request.put('/api/project', { data: { ...project, targets: { ...targets, google: { ...targets.google, enabled: false } } } });

    await page.goto('/#/screenshots');
    const neededBy = page.getByRole('list').filter({ hasText: 'Apple App Store' });
    await expect(neededBy).toContainText('Web and social');
    await expect(neededBy).not.toContainText('Google Play');
  });
});
