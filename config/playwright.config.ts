import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

const windowsChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const executablePath = process.env.LIFEATLAS_CHROME_PATH ??
  (process.platform === 'win32' && existsSync(windowsChrome) ? windowsChrome : undefined)

export default defineConfig({
  testDir: '../e2e',
  outputDir: '../test-results',
  timeout: 30_000,
  workers: 2,
  use: {
    ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4180/LifeAtlas/',
    locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light',
    serviceWorkers: 'block',
    launchOptions: { executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] },
    trace: 'off', screenshot: 'off', video: 'off',
  },
  webServer: {
    cwd: '..',
    command: 'npm run preview -- --port 4180 --strictPort',
    url: 'http://127.0.0.1:4180/LifeAtlas/',
    timeout: 20_000,
  },
})
