import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html']],
  
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  globalSetup: require.resolve('./auth-global-setup.ts'),

  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth-global-setup\.ts/,
    },
    {
      name: 'authenticated-chrome',
      use: { 
        ...devices['Desktop Chrome'], 
        viewport: { width: 1440, height: 900 },
        storageState: 'auth-state.json',
      },
      dependencies: ['auth-setup'],
    },
  ],

  timeout: 45000,
});
