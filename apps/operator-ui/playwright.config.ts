import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5177',
    headless: true,
  },
  // Use the already running Vite dev server on 5177 during local runs
});


