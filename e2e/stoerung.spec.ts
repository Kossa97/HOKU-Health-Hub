import { expect, test } from './support/fixtures'
import { seedBpc157 } from './support/myStack'

/**
 * Störung: Supabase und andere Dienste fallen aus (Schalter im Profil bzw.
 * `tyd_stoerung` im Speicher) oder das Gerät hat kein Netz. Die App bleibt
 * bedienbar und zeigt die zuletzt geladenen Daten (src/lib/stoerung.ts).
 */

test('simulierte Störung: nach dem Neuladen kein weißer Bildschirm, Daten aus dem Offline-Cache', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-20' })
  await page.goto('/my-stack')
  await expect(page.getByText('BPC-157').first()).toBeVisible()

  await page.evaluate(() => localStorage.setItem('tyd_stoerung', '1'))
  const anfragenVorher = mock.rpcCalls.length
  await page.reload()

  const hinweis = page.locator('[data-verbindungs-hinweis="simuliert"]')
  await expect(hinweis).toContainText('Störung simuliert')
  await expect(page.getByText('BPC-157').first()).toBeVisible()
  await expect(page.locator('[data-fehler-grenze]')).toHaveCount(0)
  // Beim Dienst kam nichts an
  expect(mock.rpcCalls.length).toBe(anfragenVorher)

  await hinweis.getByRole('button', { name: 'Beenden' }).click()
  await expect(hinweis).toBeHidden()
  expect(await page.evaluate(() => localStorage.getItem('tyd_stoerung'))).toBeNull()
})

test('ohne Netz: Hinweis erscheint, Seitenwechsel zeigt gemerkte Daten', async ({ page, mock, context }) => {
  seedBpc157(mock, { startDate: '2026-09-20' })
  await page.goto('/my-stack')
  await expect(page.getByText('BPC-157').first()).toBeVisible()
  // Innerhalb der App weiter (kein Neuladen — der Service Worker ist in den Tests aus)
  await page.locator('a[href="/kalender"]').first().click()
  await expect(page).toHaveURL(/\/kalender$/)

  await context.setOffline(true)
  await expect(page.locator('[data-verbindungs-hinweis="offline"]')).toBeVisible()

  // Zurück zu My Stack: die Daten kommen aus dem Cache
  await page.locator('a[href="/my-stack"]').first().click()
  await expect(page).toHaveURL(/\/my-stack$/)
  await expect(page.getByText('BPC-157').first()).toBeVisible()
  await expect(page.locator('[data-fehler-grenze]')).toHaveCount(0)

  await context.setOffline(false)
  await expect(page.locator('[data-verbindungs-hinweis]')).toBeHidden()
})
