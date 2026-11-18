import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    acceptDownloads: true,
  },
  webServer: {
    command: 'node build.mjs --serve',
    port: 4173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
