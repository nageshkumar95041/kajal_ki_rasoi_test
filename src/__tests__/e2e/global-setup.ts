/**
 * global-setup.ts — Playwright global setup
 *
 * Free Render instances spin down after ~15 min of inactivity and take
 * 30–60 s to cold-start. This file pings the base URL repeatedly until
 * it gets a successful response, so no test ever hits a sleeping server.
 *
 * Place this file at: src/__tests__/e2e/global-setup.ts
 */

import { chromium, FullConfig } from '@playwright/test';

const MAX_ATTEMPTS = 12;       // 12 × 10 s = up to 2 minutes
const RETRY_DELAY_MS = 10_000;
const PAGE_TIMEOUT_MS = 15_000;

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;

  // Skip wake-up when running against localhost
  if (!baseURL || baseURL.includes('localhost')) {
    console.log('[global-setup] Local environment detected — skipping wake-up ping.');
    return;
  }

  console.log(`[global-setup] Waking up Render service at ${baseURL} …`);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  let alive = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await page.goto(baseURL, {
        waitUntil: 'domcontentloaded',
        timeout: PAGE_TIMEOUT_MS,
      });

      if (response && response.ok()) {
        console.log(`[global-setup] Service is up after ${attempt} attempt(s). ✓`);
        alive = true;
        break;
      }

      console.log(`[global-setup] Attempt ${attempt}/${MAX_ATTEMPTS}: status ${response?.status()} — retrying in ${RETRY_DELAY_MS / 1000}s …`);
    } catch (err) {
      console.log(`[global-setup] Attempt ${attempt}/${MAX_ATTEMPTS}: ${(err as Error).message} — retrying in ${RETRY_DELAY_MS / 1000}s …`);
    }

    await page.waitForTimeout(RETRY_DELAY_MS);
  }

  await browser.close();

  if (!alive) {
    throw new Error(
      `[global-setup] Service at ${baseURL} did not respond after ${MAX_ATTEMPTS} attempts. ` +
      'Check your Render dashboard — the deployment may have failed.'
    );
  }
}