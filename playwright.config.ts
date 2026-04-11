import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Configuration — Kajal Ki Rasoi
 *
 * Local:   BASE_URL defaults to http://localhost:3000
 * CI/CD:   Set BASE_URL env var to your feature branch deployment URL
 *          e.g. https://kajal-ki-rasoi-test.onrender.com
 *
 * Free Render note: instances spin down after inactivity. The globalSetup
 * file pings the service until it responds before any tests run.
 */

export default defineConfig({
  testDir: './src/__tests__/e2e',
  testMatch: '**/*.spec.ts',

  // Wake up the Render instance before the test suite starts
  globalSetup: './src/__tests__/e2e/global-setup.ts',

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // FIX: increased timeouts to tolerate Render's slow cold-start responses
    actionTimeout:     20_000,
    navigationTimeout: 30_000,
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

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url:     'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});