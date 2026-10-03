import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, retries: 0,
  timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command:'npm run dev -- --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI,timeout:30000 },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], defaultBrowserType: 'webkit' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } } },
  ],
});
