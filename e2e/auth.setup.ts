/**
 * Runs once before the test suite. Signs in with email/password and saves
 * the browser storage state so authenticated tests skip the login flow.
 *
 * Requires TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test
 */
import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = new URL('.auth/user.json', import.meta.url).pathname;

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Wait until we've left the login page (redirect to project or /projects)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });

  await page.context().storageState({ path: AUTH_FILE });
});
