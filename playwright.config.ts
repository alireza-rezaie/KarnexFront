import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const localChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const e2ePort = Number(process.env.KARNEX_E2E_PORT ?? 4173)
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: e2eBaseUrl,
    browserName: 'chromium',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    launchOptions: existsSync(localChrome) ? { executablePath: localChrome } : undefined,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: e2eBaseUrl,
    // E2E owns a dedicated port, so it cannot test another app by accident.
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
