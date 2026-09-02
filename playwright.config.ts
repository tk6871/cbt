import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tools',
  timeout: 90_000,
  workers: 1,
  webServer: process.env.CBT_TEST_URL ? undefined : {
    command: 'python3 -m http.server 4173 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  use: {
    baseURL: process.env.CBT_TEST_URL || 'http://127.0.0.1:4173',
    headless: true,
    channel: 'chrome',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'iphone-14-pro', use: { ...devices['iPhone 14 Pro'], browserName: 'chromium' } },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true } },
  ],
  reporter: [['list']],
});
