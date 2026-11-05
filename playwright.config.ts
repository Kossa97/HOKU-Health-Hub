import { defineConfig, devices } from '@playwright/test'

/**
 * Geraetetests: die gebaute App im Browser, Supabase nachgebildet
 * (`e2e/support/mockSupabase.ts`). Kein Netz, keine echten Daten.
 *
 *   npm run test:e2e
 *
 * Drei Chromium-Profile und ein WebKit-Profil mit iPhone-Emulation.
 * Die Profile ersetzen keinen Test auf einem physischen iPhone.
 */
const PORT = 5197
const chromium = process.env.PLAYWRIGHT_CHROMIUM_PATH
  ?? (process.env.PLAYWRIGHT_BROWSERS_PATH === '/opt/pw-browsers' ? '/opt/pw-browsers/chromium' : undefined)
const chromiumLaunchOptions = chromium ? { executablePath: chromium } : {}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  // In CI: Anmerkungen am Commit plus HTML-Bericht (Trace, Screenshot) als Artefakt.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium', launchOptions: chromiumLaunchOptions } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'], launchOptions: chromiumLaunchOptions } },
    { name: 'iphone-se', use: { ...devices['iPhone SE'], browserName: 'chromium', defaultBrowserType: 'chromium', launchOptions: chromiumLaunchOptions } },
    { name: 'iphone-13-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: {
    command: `npx vite build --outDir e2e/.dist --emptyOutDir && npx vite preview --outDir e2e/.dist --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Immer neu bauen: ein noch laufender Server hielte einen alten Stand.
    reuseExistingServer: false,
    timeout: 240_000,
    // Keine Sentry-Berichte oder Source-Map-Uploads, auch mit lokaler .env.
    // VITE_HEALTH_DEMO: Testdaten statt Uhr (src/lib/healthDemo.ts), nur wenn ein Test sie einschaltet.
    env: { VITE_SENTRY_DSN: '', SENTRY_AUTH_TOKEN: '', VITE_HEALTH_DEMO: '1' },
  },
})
