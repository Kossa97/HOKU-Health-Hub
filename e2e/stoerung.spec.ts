import { expect, test } from './support/fixtures'
import type { Page } from '@playwright/test'
import { SUPABASE_ORIGIN } from './support/mockSupabase'
import { seedBpc157 } from './support/myStack'

function gemerkteAntworten(page: Page): Promise<number> {
  return page.evaluate(async () => {
    // Nicht selbst anlegen — sonst fehlte der App beim ersten Öffnen die Tabelle
    if (!(await indexedDB.databases()).some(d => d.name === 'tyd-offline-daten')) return 0
    return new Promise<number>(resolve => {
      const offen = indexedDB.open('tyd-offline-daten')
      offen.onsuccess = () => {
        if (!offen.result.objectStoreNames.contains('antworten')) return resolve(0)
        const zaehlen = offen.result.transaction('antworten').objectStore('antworten').count()
        zaehlen.onsuccess = () => { offen.result.close(); resolve(zaehlen.result) }
        zaehlen.onerror = () => resolve(-1)
      }
      offen.onerror = () => resolve(-1)
    })
  })
}

/**
 * Störung: Supabase und andere Dienste fallen aus (Schalter im Profil bzw.
 * `tyd_stoerung` im Speicher) oder das Gerät hat kein Netz. Die App bleibt
 * bedienbar und zeigt die zuletzt geladenen Daten (src/lib/stoerung.ts).
 */

test('simulierte Störung: nach dem Neuladen kein weißer Bildschirm, Daten aus dem Offline-Cache', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-20' })
  await page.goto('/my-stack')
  await expect(page.getByText('BPC-157').first()).toBeVisible()

  // Erst neu laden, wenn die Antworten im Offline-Speicher liegen
  await expect.poll(() => gemerkteAntworten(page), { message: 'Antworten im Offline-Speicher (IndexedDB)' }).toBeGreaterThan(0)

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

  // Netz weg. Die Nachbildung antwortet sonst auch offline — also jede
  // Supabase-Anfrage ausdrücklich scheitern lassen (zuletzt angemeldet, gewinnt)
  await page.route(`${SUPABASE_ORIGIN}/**`, route => route.abort('internetdisconnected'))
  await context.setOffline(true)

  // Zurück zu My Stack: die Daten kommen aus dem Offline-Speicher
  await page.locator('a[href="/my-stack"]').first().click()
  await expect(page).toHaveURL(/\/my-stack$/)
  await expect(page.locator('[data-verbindungs-hinweis="offline"]')).toBeVisible()
  await expect(page.getByText('BPC-157').first()).toBeVisible()
  await expect(page.locator('[data-fehler-grenze]')).toHaveCount(0)

  await page.unroute(`${SUPABASE_ORIGIN}/**`)
  await context.setOffline(false)
  await expect(page.locator('[data-verbindungs-hinweis]')).toBeHidden()
})
