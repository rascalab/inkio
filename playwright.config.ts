import { defineConfig } from '@playwright/test';

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'line',
  // Pinned explicitly (equal to Playwright defaults): timeouts must be a
  // deliberate choice, and traces stay failure-only so passing runs leave
  // no artifacts behind. CI artifact retention bounds the failure traces.
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'firefox',
      use: { browserName: 'firefox' },
    },
  ],
  webServer: [
    {
      command: 'pnpm --dir examples/basic-react exec vite preview --host localhost --port 4173',
      url: 'http://localhost:4173',
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      command: 'pnpm --dir examples/next-app-router exec next start --hostname localhost --port 4174',
      url: 'http://localhost:4174',
      reuseExistingServer,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
});
