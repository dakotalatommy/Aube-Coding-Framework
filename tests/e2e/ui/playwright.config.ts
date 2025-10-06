import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './',
  testMatch: '**/*.spec.ts',
  
  // Test configuration
  fullyParallel: false, // Run sequentially for splash debugging
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  
  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],
  
  // Global test settings
  use: {
    baseURL: process.env.BASE_URL || 'https://app.brandvx.io',
    
    // Browser context options
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Timeouts
    actionTimeout: 30000,
    navigationTimeout: 30000,
    
    // Viewport (Mac laptop - per user preference)
    viewport: { width: 1440, height: 900 },
    
    // User agent
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  },
  
  // Projects for different browsers/viewports
  projects: [
    {
      name: 'laptop-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
      },
    },
    
    {
      name: 'iphone',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 375, height: 667 },
      },
    },
    
    // Add tablet viewport
    {
      name: 'tablet',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 768, height: 1024 },
      },
    },
  ],
  
  // Output folders
  outputDir: 'test-results/output',
  
  // Web server (optional - for local dev)
  // webServer: {
  //   command: 'npm run dev',
  //   port: 5174,
  //   reuseExistingServer: !process.env.CI,
  // },
});
