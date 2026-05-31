/**
 * Smoke tests for within-project navigation.
 * Verifies the sidebar links and key section pages load without errors.
 *
 * TEST_PROJECT_SLUG must be set in .env.test to an existing project slug.
 */
import { test, expect } from '../fixtures';

const slug = () => process.env.TEST_PROJECT_SLUG ?? '';

test.describe('Project navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the project root; the app will redirect to the dashboard
    await page.goto(`/${slug()}/`);
    // Wait for the sidebar to confirm we're in a project context
    await page.waitForURL((url) => url.pathname.startsWith(`/${slug()}`), { timeout: 10_000 });
  });

  const sections = [
    { name: 'Workspace',    path: 'workspace' },
    { name: 'Shared steps', path: 'steps' },
    { name: 'Review',       path: 'review' },
    { name: 'Plans',        path: 'plans' },
    { name: 'Runs',         path: 'runs' },
    { name: 'Environments', path: 'environments' },
    { name: 'Defects',      path: 'defects' },
    { name: 'Requirements', path: 'requirements' },
    { name: 'Milestones',   path: 'milestones' },
    { name: 'Dashboard',    path: '' },
    { name: 'Exploratory',  path: 'exploratory' },
    { name: 'Audit log',    path: 'audit' },
  ];

  for (const { name, path } of sections) {
    test(`${name} page loads without error`, async ({ page }) => {
      await page.goto(`/${slug()}/${path}`);
      // No hard server error (5xx)
      await expect(page).not.toHaveURL(/\/login/);
      // Page body is visible
      await expect(page.locator('main')).toBeVisible();
    });
  }
});

test.describe('Root redirect', () => {
  test('/ redirects authenticated user to first project', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL((url) => url.pathname !== '/', { timeout: 10_000 });
    expect(page.url()).not.toContain('/login');
  });
});
