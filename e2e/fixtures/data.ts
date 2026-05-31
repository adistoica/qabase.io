/**
 * Static fixture data for isolated Playwright tests.
 * No real backend is contacted — every /api/* request is intercepted and
 * answered from this file (or from test-specific overrides).
 */

export const TEST_USER = {
  id: 'test-user-00000000-0000-0000-0000-000000000001',
  email: 'test@example.com',
  display_name: 'Test User',
  roles: ['admin'] as string[],
};

/** Must contain the project whose slug is set in TEST_PROJECT_SLUG (.env.test). */
export const TEST_PROJECTS = [
  {
    id: 'test-proj-000000000001',
    name: 'Smecher',
    slug: process.env.TEST_PROJECT_SLUG ?? 'smecher',
    code_prefix: 'SMEC',
    description: '',
    role_overrides: {},
    created_at: '2025-01-01T00:00:00.000Z',
    updated_at: '2025-01-01T00:00:00.000Z',
  },
  {
    id: 'test-proj-000000000002',
    name: 'Alpha',
    slug: 'alpha',
    code_prefix: 'ALPH',
    description: '',
    role_overrides: {},
    created_at: '2025-01-02T00:00:00.000Z',
    updated_at: '2025-01-02T00:00:00.000Z',
  },
];
