import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

config({ path: '.env.test' });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup runs once, saves session to disk
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /public\//,
    },
    // Unauthenticated tests (login page etc.) run independently
    {
      name: 'chromium-public',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /public\/.+\.spec\.ts/,
    },
  ],

  // Start the dev server automatically when running locally
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    cwd: './frontend',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
