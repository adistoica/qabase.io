import { test as base, expect, type Page } from '@playwright/test';
import { TEST_USER, TEST_PROJECTS } from './fixtures/data';

export { expect };

class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Sign in' });
  }
  get emailInput() {
    return this.page.getByLabel('Email');
  }
  get passwordInput() {
    return this.page.getByLabel('Password');
  }
  get submitButton() {
    return this.page.getByRole('button', { name: 'Sign in', exact: true });
  }
  get googleButton() {
    return this.page.getByRole('button', { name: /sign in with google/i });
  }
  get errorBanner() {
    return this.page.locator('.bg-red-50');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}

class ProjectsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/projects');
  }

  get heading() {
    return this.page.getByRole('heading', { name: 'Projects' });
  }
  get newProjectButton() {
    return this.page.getByRole('button', { name: /new project/i });
  }
  get projectCards() {
    return this.page.locator('.card').filter({ has: this.page.locator('a', { hasText: 'Open' }) });
  }
  get createButton() {
    return this.page.getByRole('button', { name: 'Create project' });
  }
  get createFormError() {
    // Scoped to the New Project panel so the toast doesn't match too.
    return this.page.locator('.card')
      .filter({ has: this.page.getByRole('heading', { name: 'New project' }) })
      .getByText(/required|already taken/i);
  }

  projectCard(name: string) {
    return this.page.locator('.card').filter({ hasText: name });
  }

  renameButton(projectName: string) {
    return this.projectCard(projectName).getByTitle('Rename');
  }

  deleteButton(projectName: string) {
    return this.projectCard(projectName).getByTitle('Delete');
  }
}

export const test = base.extend<{
  loginPage: LoginPage;
  projectsPage: ProjectsPage;
}>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  projectsPage: async ({ page }, use) => use(new ProjectsPage(page)),
});
