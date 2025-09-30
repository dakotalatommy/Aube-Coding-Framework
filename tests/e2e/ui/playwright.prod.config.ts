import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false, // Run sequentially for splash diagnostics
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // Single worker to avoid auth conflicts
  reporter: [['list'], ['html']],
  
  use: {
    baseURL: 'https://124f0c6f.brandvx-operator-ui.pages.dev',
    trace: 'on',
    screenshot: 'on',
    video: 'on',
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
  },

  projects: [
    {
      name: 'production-chrome',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],

  timeout: 45000,
});
