import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'https://app.brandvx.io',
    headless: true,
  },
  // Use production domain for smoke
});


