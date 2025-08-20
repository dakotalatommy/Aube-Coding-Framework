import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
  },
  webServer: {
    command: 'bash -lc "npm run build --silent && npx serve -s dist -l 5174"',
    port: 5174,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});


