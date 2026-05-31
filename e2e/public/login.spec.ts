import { test, expect } from '../fixtures';

test.describe('Login page', () => {
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.goto();
  });

  test('renders sign-in form', async ({ loginPage }) => {
    await expect(loginPage.heading).toBeVisible();
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('shows Google OAuth button', async ({ loginPage }) => {
    await expect(loginPage.googleButton).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ loginPage }) => {
    await loginPage.login('wrong@example.com', 'badpassword');
    await expect(loginPage.errorBanner).toBeVisible();
  });

  test('submit button is disabled while loading', async ({ page }) => {
    // Override fetch before the Supabase client initialises so the auth call
    // never resolves, keeping the button in its loading state indefinitely.
    await page.addInitScript(() => {
      const orig = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input
          : input instanceof URL ? input.href
          : (input as Request).url;
        if (url.includes('auth/v1/token')) return new Promise(() => {});
        return orig(input, init);
      };
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password');

    // Use type selector so the locator stays stable while the button text changes
    const submitBtn = page.locator('button[type="submit"]');
    // Fire the click without awaiting so we can observe the loading state
    submitBtn.click();
    await expect(submitBtn).toBeDisabled();
    await expect(submitBtn).toContainText('Signing in');
  });

  test('email field validates format', async ({ loginPage, page }) => {
    await loginPage.emailInput.fill('not-an-email');
    await loginPage.submitButton.click();
    // Browser native validation prevents submission
    const validity = await page.evaluate(() =>
      (document.getElementById('email') as HTMLInputElement).validity.valid
    );
    expect(validity).toBe(false);
  });
});
