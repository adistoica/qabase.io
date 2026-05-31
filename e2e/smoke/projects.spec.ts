/**
 * Tests for the Projects management page.
 * Runs with saved auth session — user is already signed in.
 */
import { test, expect } from '../fixtures';

// Known project data used by mocked-API tests so assertions are deterministic.
const MOCK_PROJECTS = [
  { id: 'p1', name: 'Acme QA', slug: 'acme-qa', code_prefix: 'ACME', description: 'Main suite', role_overrides: {} },
  { id: 'p2', name: 'Beta Suite', slug: 'beta-suite', code_prefix: 'BETA', description: '', role_overrides: {} },
];

/** Intercept GET /api/projects and return the supplied data. */
async function mockGetProjects(page: import('@playwright/test').Page, data: typeof MOCK_PROJECTS) {
  await page.route(
    (url) => url.pathname === '/api/projects',
    async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: data });
      } else {
        await route.continue();
      }
    },
  );
}

// ---------------------------------------------------------------------------
// Smoke – works against the real backend
// ---------------------------------------------------------------------------

test.describe('Projects page', () => {
  test.beforeEach(async ({ projectsPage }) => {
    await projectsPage.goto();
  });

  test('renders page heading', async ({ projectsPage }) => {
    await expect(projectsPage.heading).toBeVisible();
  });

  test('shows New Project button', async ({ projectsPage }) => {
    await expect(projectsPage.newProjectButton).toBeVisible();
  });

  test('displays at least one project card', async ({ projectsPage }) => {
    await expect(projectsPage.projectCards.first()).toBeVisible({ timeout: 10_000 });
  });

  test('each project card has an Open link', async ({ projectsPage }) => {
    await projectsPage.projectCards.first().waitFor();
    for (const card of await projectsPage.projectCards.all()) {
      await expect(card.getByRole('link', { name: 'Open' })).toBeVisible();
    }
  });

  test('New Project form opens and closes', async ({ projectsPage, page }) => {
    await projectsPage.newProjectButton.click();
    await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: 'New project' })).not.toBeVisible();
  });

  test('New Project form auto-generates slug from name', async ({ projectsPage, page }) => {
    await projectsPage.newProjectButton.click();
    await page.getByPlaceholder('My Project').fill('My Test Project');
    await expect(page.getByPlaceholder('my-project')).toHaveValue('my-test-project');
  });
});

// ---------------------------------------------------------------------------
// Create form – validation & field behaviour (no API mutations)
// ---------------------------------------------------------------------------

test.describe('Create form – validation', () => {
  test.beforeEach(async ({ projectsPage, page }) => {
    await projectsPage.goto();
    await projectsPage.newProjectButton.click();
    await page.getByRole('heading', { name: 'New project' }).waitFor();
  });

  test('requires name before submitting', async ({ projectsPage }) => {
    await projectsPage.createButton.click();
    await expect(projectsPage.createFormError).toHaveText('Name is required');
  });

  test('shows server error when slug is already taken', async ({ projectsPage, page }) => {
    // Mock the POST so no real project is created and the response is deterministic.
    await page.route(
      (url) => url.pathname === '/api/projects',
      async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({ status: 400, json: { detail: 'slug already taken' } });
        } else {
          await route.continue();
        }
      },
    );
    await page.getByPlaceholder('My Project').fill('My Project');
    await projectsPage.createButton.click();
    await expect(projectsPage.createFormError).toHaveText('slug already taken');
  });

  test('requires code prefix before submitting', async ({ projectsPage, page }) => {
    await page.getByPlaceholder('My Project').fill('Test');
    await page.getByPlaceholder('MP').clear();
    await projectsPage.createButton.click();
    await expect(projectsPage.createFormError).toHaveText('Code prefix is required');
  });

  test('error clears when form is closed and reopened', async ({ projectsPage, page }) => {
    await projectsPage.createButton.click();
    await expect(projectsPage.createFormError).toBeVisible();

    await page.getByRole('button', { name: /cancel/i }).click();
    await projectsPage.newProjectButton.click();
    await expect(projectsPage.createFormError).not.toBeVisible();
  });

  test('auto-generates code prefix from project name', async ({ page }) => {
    await page.getByPlaceholder('My Project').fill('Acme Platform');
    // 'ACMEPLATFORM'.slice(0, 4) → 'ACME'
    await expect(page.getByPlaceholder('MP')).toHaveValue('ACME');
  });

  test('slug sanitises spaces and special characters', async ({ page }) => {
    await page.getByPlaceholder('My Project').fill('Hello World! 2025');
    await expect(page.getByPlaceholder('my-project')).toHaveValue('hello-world-2025');
  });

  test('code prefix input uppercases and strips non-alphanumeric chars', async ({ page }) => {
    await page.getByPlaceholder('My Project').fill('Test'); // seed an initial value
    const prefixInput = page.getByPlaceholder('MP');
    await prefixInput.fill('ab-1');         // 'ab-1' → 'AB1'
    await expect(prefixInput).toHaveValue(/^[A-Z0-9]+$/);
    await expect(prefixInput).not.toHaveValue(/-/);
  });
});

// ---------------------------------------------------------------------------
// Card content – uses mocked API for deterministic assertions
// ---------------------------------------------------------------------------

test.describe('Card content', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetProjects(page, MOCK_PROJECTS);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();
  });

  test('card shows the project slug as a badge', async ({ page }) => {
    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await expect(card.locator('.badge').filter({ hasText: 'acme-qa' })).toBeVisible();
  });

  test('card shows the code-prefix ID format badge', async ({ page }) => {
    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await expect(card.locator('.badge').filter({ hasText: 'ACME-###' })).toBeVisible();
  });

  test('Open link href points to /:slug/workspace', async ({ page }) => {
    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await expect(card.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/acme-qa/workspace');
  });

  test('description is shown on cards that have one', async ({ page }) => {
    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await expect(card.getByText('Main suite')).toBeVisible();
  });

  test('cards without a description show no description text', async ({ page }) => {
    const card = page.locator('.card').filter({ hasText: 'Beta Suite' }).first();
    // No description paragraph should appear
    await expect(card.locator('p.text-xs')).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Inline rename – uses mocked API; no actual PUT is made
// ---------------------------------------------------------------------------

test.describe('Inline rename', () => {
  test.beforeEach(async ({ page }) => {
    await mockGetProjects(page, MOCK_PROJECTS);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();
  });

  test('pencil button enters edit mode', async ({ page }) => {
    // Identify the card by its slug badge — stable in both view and edit mode.
    const card = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'acme-qa' }) });
    await card.getByTitle('Rename').click();

    // Edit mode shows the name input and Save/Cancel; the Rename button is gone.
    await expect(card.locator('input.font-semibold')).toBeVisible();
    await expect(card.getByRole('button', { name: /save/i })).toBeVisible();
    await expect(card.getByTitle('Rename')).not.toBeVisible();
  });

  test('edit mode pre-fills the current project name', async ({ page }) => {
    const card = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'acme-qa' }) });
    await card.getByTitle('Rename').click();

    await expect(card.locator('input.font-semibold')).toHaveValue('Acme QA');
  });

  test('cancel edit restores view mode', async ({ page }) => {
    const card = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'acme-qa' }) });
    await card.getByTitle('Rename').click();
    await card.getByRole('button', { name: /cancel/i }).click();

    await expect(card.getByTitle('Rename')).toBeVisible();
    await expect(card.getByRole('link', { name: 'Open' })).toBeVisible();
    await expect(card.locator('input')).not.toBeVisible();
  });

  test('editing one card does not affect other cards', async ({ page }) => {
    const acmeCard = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'acme-qa' }) });
    const betaCard = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'beta-suite' }) });

    await acmeCard.getByTitle('Rename').click();

    // Beta card should still be in view mode
    await expect(betaCard.getByTitle('Rename')).toBeVisible();
    await expect(betaCard.getByRole('link', { name: 'Open' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Delete protection – uses mocked API
// ---------------------------------------------------------------------------

test.describe('Delete protection', () => {
  test('delete button is disabled when only one project exists', async ({ page }) => {
    await mockGetProjects(page, [MOCK_PROJECTS[0]]);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();

    await expect(page.getByTitle('Delete')).toBeDisabled();
  });

  test('delete button is enabled when multiple projects exist', async ({ page }) => {
    await mockGetProjects(page, MOCK_PROJECTS);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();

    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await expect(card.getByTitle('Delete')).toBeEnabled();
  });

  test('delete opens confirmation modal with project name', async ({ page }) => {
    await mockGetProjects(page, MOCK_PROJECTS);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();

    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await card.getByTitle('Delete').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Delete "Acme QA"?');
    await expect(dialog).toContainText('cannot be undone');
  });

  test('cancelling the delete modal dismisses it without navigating away', async ({ page }) => {
    await mockGetProjects(page, MOCK_PROJECTS);
    await page.goto('/projects');
    await page.locator('.card').filter({ has: page.locator('a', { hasText: 'Open' }) }).first().waitFor();

    const card = page.locator('.card').filter({ hasText: 'Acme QA' }).first();
    await card.getByTitle('Delete').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page).toHaveURL('/projects');
  });
});
