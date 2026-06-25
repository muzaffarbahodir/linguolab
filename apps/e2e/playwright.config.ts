import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

// Shared env for the portal when started for E2E
const portalEnv = {
  API_URL: 'http://localhost:9999',
  NEXTAUTH_URL: 'http://localhost:3002',
  NEXTAUTH_SECRET: 'e2e-test-secret-minimum-32-chars-long!!!',
  NODE_ENV: 'test',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: [
    // 1. Mock backend API on port 9999
    {
      command: 'node mock-server/index.mjs',
      port: 9999,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    // 2. Student/teacher portal on port 3002
    {
      command: isCI
        ? 'pnpm --filter @linguolab/portal start'
        : 'pnpm --filter @linguolab/portal dev',
      port: 3002,
      timeout: 180_000,
      reuseExistingServer: !isCI,
      env: portalEnv,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
