import { defineConfig } from '@playwright/test';

const reuseExistingServer = !process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'line',
  use: {
    headless: true,
    trace: 'retain-on-failure',
  },
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
