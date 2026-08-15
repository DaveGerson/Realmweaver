import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Verifies the reused/launched server is actually Realmweaver before any
  // spec runs — see e2e/global-setup.ts (finding #85, scenario 2).
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    // Vite binds to 127.0.0.1 (see vite.config.ts `host`), not localhost —
    // on hosts where Node's DNS resolver prefers ::1 the two don't connect.
    baseURL: 'http://127.0.0.1:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:4200',
    reuseExistingServer: !process.env.CI,
    // CI runs with reuseExistingServer:false, so this always pays for a cold
    // dep-optimization run; 30s was cutting it close on CI runners.
    timeout: 60000,
  },
});
