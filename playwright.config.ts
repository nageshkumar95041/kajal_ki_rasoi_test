import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — Kajal Ki Rasoi
 *
 * Local:   BASE_URL defaults to http://localhost:3000
 * CI/CD:   Set BASE_URL env var to your feature branch deployment URL
 *          e.g. https://kajal-ki-rasoi-feature.up.railway.app
 */

export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: '**/*.spec.ts',

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build if test.only is accidentally committed */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests once on CI */
  retries: process.env.CI ? 1 : 0,

  /* Limit parallel workers on CI to avoid flakiness */
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    /* Base URL — override with BASE_URL env var for feature branch testing */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect traces on first retry for debugging */
    trace: 'on-first-retry',

    /* Screenshot only on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Reasonable timeouts */
    actionTimeout:     10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  /* Start local dev server automatically when BASE_URL is not set externally */
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url:     'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
