import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the built app served by the CLI (same path as `npx app-media-creator`).
const port = 4791;
const workspace = 'test-results/e2e-workspace';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
  },
  // project.spec, export.spec and screenshots.spec change the shared workspace: they run one after another,
  // everything else in parallel.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /(project|export|screenshots|logo)\.spec\.ts/ },
    { name: 'settings', use: { ...devices['Desktop Chrome'] }, testMatch: /project\.spec\.ts/ },
    { name: 'export', use: { ...devices['Desktop Chrome'] }, testMatch: /export\.spec\.ts/, dependencies: ['settings'] },
    { name: 'screenshots', use: { ...devices['Desktop Chrome'] }, testMatch: /screenshots\.spec\.ts/, dependencies: ['export'] },
    { name: 'logo', use: { ...devices['Desktop Chrome'] }, testMatch: /logo\.spec\.ts/, dependencies: ['screenshots'] },
  ],
  webServer: {
    command: `npm run build && node dist/cli/index.js --port ${port} --no-open --workspace ${workspace}`,
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
