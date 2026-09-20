import { defineConfig } from '@playwright/test'

// The browser tests run against the demo build (sample data, no database) using the copy of
// Microsoft Edge that is already installed, so nothing large needs downloading.
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5199',
    channel: 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite --mode demo --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
