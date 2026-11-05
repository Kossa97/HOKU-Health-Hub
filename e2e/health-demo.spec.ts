import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/**
 * Uhrdaten ohne Uhr: Der Testdaten-Modus (src/lib/healthDemo.ts) ersetzt
 * Apple Health / Health Connect. Der Playwright-Build läuft mit
 * VITE_HEALTH_DEMO=1, eingeschaltet wird pro Test über den Browser-Speicher.
 */
async function healthDemo(page: Page, scenario: string) {
  await page.addInitScript(value => {
    try { localStorage.setItem('hoku:health-demo', value) } catch { /* ohne Speicher */ }
  }, scenario)
}

const card = (page: Page, label: string) => page.locator('.lg-surface', { hasText: label })

test('/health zeigt Schritte, Puls und Schlaf von der Uhr', async ({ page, mock }) => {
  void mock // angemeldeter Nutzer
  await healthDemo(page, 'normal')
  await page.goto('/health')

  await expect(page.getByText('Nur in der App verfügbar')).toHaveCount(0)
  await expect(card(page, 'Schritte heute')).toContainText(/\d/)
  await expect(card(page, 'Herzrate')).toContainText(/\d+ bpm/)
  await expect(card(page, 'Schlaf letzte Nacht')).toContainText(/\d+(,\d)? h/)
})

test('/health ohne aufgezeichnete Daten bleibt ruhig', async ({ page, mock }) => {
  void mock // angemeldeter Nutzer
  await healthDemo(page, 'leer')
  await page.goto('/health')

  await expect(card(page, 'Schritte heute')).toContainText('0')
  await expect(card(page, 'Herzrate')).toContainText('—')
  await expect(card(page, 'Schlaf letzte Nacht')).toContainText('—')
})

test('ohne Testdaten-Modus bleibt der Browser ohne Uhrdaten', async ({ page, mock }) => {
  void mock // angemeldeter Nutzer
  await page.goto('/health')
  await expect(page.getByText('Nur in der App verfügbar').first()).toBeVisible()
})

test('Training übernimmt die Workouts der Uhr', async ({ page, mock }) => {
  await healthDemo(page, 'normal')
  mock.insert('training_settings', { user_id: TEST_USER.id, settings: { healthImport: true } })
  await page.goto('/training')

  const imported = () => mock.table('training_sessions').filter(row => row.source === 'healthkit')
  await expect.poll(() => imported().length).toBeGreaterThan(10)
  expect(imported().every(row => String(row.external_id).startsWith('demo-normal-'))).toBe(true)
  expect(imported().map(row => row.kind)).toEqual(expect.arrayContaining(['run', 'strength', 'cycle', 'yoga']))
})
