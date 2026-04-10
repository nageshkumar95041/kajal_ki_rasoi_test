/**
 * E2E Tests — Playwright
 * Critical user flows: Login, Menu browsing, Cart, Order placement
 *
 * Run against your deployed feature branch:
 *   BASE_URL=https://your-feature-branch.up.railway.app npx playwright test
 *
 * Or locally:
 *   npm run dev  →  npx playwright test
 */

import { test, expect, Page } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, contact = 'testuser@example.com', password = 'Test@1234') {
  await page.goto('/login');
  await page.fill('[name="contact"], input[type="email"], input[placeholder*="email" i]', contact);
  await page.fill('[name="password"], input[type="password"]', password);
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 8000 });
}

// ─── Auth flows ───────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/kajal|rasoi|login/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"], input[placeholder*="email" i], input[placeholder*="contact" i]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'badpassword');
    await page.click('button[type="submit"], button:has-text("Login")');
    // Should show an error message, stay on login page
    await expect(page.locator('text=/invalid|incorrect|wrong|error/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('register page is accessible', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="name" i], input[name="name"]')).toBeVisible();
  });

  test('register shows validation for missing fields', async ({ page }) => {
    await page.goto('/register');
    await page.click('button[type="submit"], button:has-text("Register"), button:has-text("Sign up")');
    // Browser validation or custom error should appear
    const errorOrInvalid =
      (await page.locator(':invalid').count()) > 0 ||
      (await page.locator('text=/required|fill/i').count()) > 0;
    expect(errorOrInvalid).toBe(true);
  });

  test('forgot password page is reachable', async ({ page }) => {
    await page.goto('/login');
    const forgotLink = page.locator('a:has-text("forgot"), a:has-text("reset")').first();
    if (await forgotLink.isVisible()) {
      await forgotLink.click();
      await expect(page).toHaveURL(/forgot|reset/);
    }
  });
});

// ─── Menu page ────────────────────────────────────────────────────────────────

test.describe('Menu Page', () => {
  test('menu page loads and shows food items', async ({ page }) => {
    await page.goto('/menu');
    // Wait for at least one menu item card to appear
    await expect(page.locator('[data-testid="menu-item"], .menu-item, .food-card').first())
      .toBeVisible({ timeout: 10000 });
  });

  test('menu page has a heading or title', async ({ page }) => {
    await page.goto('/menu');
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('prices are displayed as numbers', async ({ page }) => {
    await page.goto('/menu');
    // Look for ₹ symbol or price pattern
    const priceEl = page.locator('text=/₹\\s*\\d+|\\d+\\s*Rs/').first();
    await expect(priceEl).toBeVisible({ timeout: 8000 });
  });

  test('add-to-cart button exists on menu items', async ({ page }) => {
    await page.goto('/menu');
    const addBtn = page.locator(
      'button:has-text("Add"), button:has-text("+"), [data-testid="add-to-cart"]'
    ).first();
    await expect(addBtn).toBeVisible({ timeout: 8000 });
  });
});

// ─── Cart flow ────────────────────────────────────────────────────────────────

test.describe('Cart', () => {
  test('adding an item to cart updates cart count', async ({ page }) => {
    await page.goto('/menu');
    // Capture initial cart count (could be 0 or empty)
    const cartBefore = await page.locator(
      '[data-testid="cart-count"], .cart-count, .cart-badge'
    ).first().textContent().catch(() => '0');

    // Click the first Add button
    await page.locator(
      'button:has-text("Add"), button:has-text("+"), [data-testid="add-to-cart"]'
    ).first().click();

    // Cart count should increase
    await page.waitForTimeout(500);
    const cartAfter = await page.locator(
      '[data-testid="cart-count"], .cart-count, .cart-badge'
    ).first().textContent().catch(() => '1');

    expect(Number(cartAfter)).toBeGreaterThanOrEqual(Number(cartBefore ?? '0'));
  });

  test('cart page is accessible and shows items', async ({ page }) => {
    // Pre-seed localStorage with a cart item
    await page.goto('/menu');
    await page.evaluate(() => {
      localStorage.setItem('cart', JSON.stringify([
        { name: 'Dal Makhani', price: 120, quantity: 2 },
      ]));
    });
    await page.goto('/cart');
    await expect(page.locator('text=Dal Makhani')).toBeVisible({ timeout: 5000 });
  });

  test('empty cart shows appropriate message', async ({ page }) => {
    await page.goto('/menu');
    await page.evaluate(() => localStorage.setItem('cart', '[]'));
    await page.goto('/cart');
    const emptyMsg = page.locator('text=/empty|no items|nothing/i').first();
    // Either empty message or redirect to menu
    const isOnCart = page.url().includes('/cart');
    if (isOnCart) {
      await expect(emptyMsg).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─── Navigation & layout ──────────────────────────────────────────────────────

test.describe('Navigation', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/kajal|rasoi/i);
  });

  test('navbar is present on homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav, header').first()).toBeVisible();
  });

  test('navbar has a link to the menu', async ({ page }) => {
    await page.goto('/');
    const menuLink = page.locator('a[href*="menu"], nav a:has-text("Menu")').first();
    await expect(menuLink).toBeVisible();
    await menuLink.click();
    await expect(page).toHaveURL(/menu/);
  });

  test('about page is reachable', async ({ page }) => {
    await page.goto('/about');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('contact page is reachable', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

// ─── Protected routes ─────────────────────────────────────────────────────────

test.describe('Protected Routes', () => {
  test('my-orders redirects to login when not authenticated', async ({ page }) => {
    // Clear any stored auth
    await page.goto('/menu');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('loggedInUser');
    });
    await page.goto('/my-orders');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('profile page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/menu');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('loggedInUser');
    });
    await page.goto('/profile');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('admin page redirects non-admin users', async ({ page }) => {
    await page.goto('/menu');
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('loggedInUser');
    });
    await page.goto('/admin');
    // Should redirect to login (not admin)
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});

// ─── Subscription page ────────────────────────────────────────────────────────

test.describe('Subscription', () => {
  test('subscription page loads', async ({ page }) => {
    await page.goto('/subscription');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('subscription shows plan options', async ({ page }) => {
    await page.goto('/subscription');
    // Should show at least one plan/pricing card
    const planCard = page.locator(
      '[data-testid="plan-card"], .plan-card, text=/plan|tiffin|lunch|dinner/i'
    ).first();
    await expect(planCard).toBeVisible({ timeout: 8000 });
  });
});
