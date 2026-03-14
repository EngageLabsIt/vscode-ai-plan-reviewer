import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: { headless: true, viewport: { width: 1280, height: 800 } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'capture',
      use: {
        ...devices['Desktop Chrome'],
        video: { mode: 'on', size: { width: 1280, height: 800 } },
      },
    },
  ],
});
