import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'
import { messungBearbeiten } from './support/blutwerte'

/**
 * Blutwerte, Etappe 1: der Bereich spricht Deutsch und Englisch, Marker
 * erscheinen mit englischem Namen und Erklaerung, Loeschen laeuft ueber ein
 * eigenes Sheet statt des Browser-Fensters. In der Datenbank bleibt der
 * deutsche Markername der Schluessel.
 */

/** Uebersicht oeffnen und unter „Marker" den Filter „Alle" waehlen (vorausgewaehlt ist „Auffällige"). */
async function markerAnsicht(page: Page) {
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
}

function wert(mock: MockSupabase, marker: string, felder: Record<string, unknown> = {}) {
  return mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker, value: 12, unit: 'µg/dL', notes: null,
    report_id: null, ref_min: null, ref_max: null, ...felder,
  })
}

test.describe('auf Englisch', () => {
  test.use({ language: 'en' })

  test('Marker, Kategorien und Erklaerung erscheinen auf Englisch', async ({ page, mock }) => {
    wert(mock, 'Kortisol', { value: 30, unit: 'µg/dL', ref_min: 5, ref_max: 25 })
    await page.goto('/blutwerte')

    await expect(page.getByRole('heading', { name: 'Blood values' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Out of range (1)' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-bw-flagged]')).toContainText('Cortisol')
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Hormones' })).toBeVisible()
    await expect(page.getByText('Kortisol')).toHaveCount(0)

    await page.getByRole('button', { name: /Cortisol/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Cortisol' })).toBeVisible()
    await expect(page.getByText('The central stress hormone.', { exact: false })).toBeVisible()
    // Bewertet nach dem Bereich aus der Quelle, nicht nach dem des Labors
    await expect(page.locator('[data-bw-status]')).toHaveText(/µg\/dL above range$/)
    await expect(page.getByRole('heading', { name: 'Notes and causes' })).toBeVisible()
    await page.locator('[data-bw-history-toggle]').click()
    await expect(page.getByText('09/15/2026')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Measurements 1' })).toHaveAttribute('aria-expanded', 'true')
  })
})

test('Marker: Filter „Auffällige" steht vorn und ist vorausgewaehlt, mit Anzahl; Tippen fuehrt zum Marker', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 30, ref_min: 5, ref_max: 25 })
  wert(mock, 'Ferritin', { value: 80, unit: 'ng/mL', ref_min: 30, ref_max: 400 })
  await page.goto('/blutwerte')

  // Oben die zwei Tabs, Marker aktiv
  await expect(page.getByRole('button', { name: 'Marker', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Befunde', exact: true })).toBeVisible()
  const tab = page.getByRole('button', { name: 'Auffällige (1)' })
  await expect(tab).toHaveAttribute('aria-pressed', 'true')
  await expect(tab).toContainText('Auffällige')
  // Vorn in der Leiste, vor „Alle" und den Kategorien
  const chips = tab.locator('..').getByRole('button')
  await expect(chips.nth(0)).toHaveAccessibleName('Auffällige (1)')
  await expect(chips.nth(1)).toHaveAccessibleName('Alle')
  await expect(chips.nth(2)).toHaveAccessibleName('Hormone')
  await expect(page.getByRole('region', { name: 'Auffällige Werte (1)' })).toBeVisible()
  // keine Sortierung in der Liste der Auffaelligen
  await expect(page.locator('#blutwerte-sort')).toHaveCount(0)
  const liste = page.locator('[data-bw-flagged]')
  await expect(liste).toContainText('Deine zuletzt gemessenen Werte außerhalb des Referenzbereichs.')
  await expect(liste).toContainText('Kortisol')
  await expect(liste).not.toContainText('Ferritin')
  if (process.env.SCREENSHOT_DIR) {
    for (const thema of ['dark', 'light']) {
      await page.evaluate(wert => document.documentElement.setAttribute('data-theme', wert), thema)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/auffaellig-${thema}.png` })
    }
  }
  // „Alle" zeigt das Raster ohne den Block
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await expect(page.locator('[data-bw-flagged]')).toHaveCount(0)
  await expect(page.locator('#blutwerte-sort')).toBeVisible()
  await tab.click()
  await liste.getByRole('button', { name: /Kortisol/ }).click()
  await expect(page.getByRole('heading', { name: 'Kortisol' })).toBeVisible()
})

test('Uebersicht: Umschalter oben wechselt zwischen Raster und Liste und merkt sich die Wahl', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 30, ref_min: 5, ref_max: 25 })
  wert(mock, 'Ferritin', { value: 80, unit: 'ng/mL', ref_min: 30, ref_max: 400 })
  await markerAnsicht(page)

  // Vorgabe: Raster, Karten ohne Kategorie-Ueberschriften
  await expect(page.locator('.bw-marker-card')).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Hormone' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Listenansicht' }).click()
  await expect(page.locator('.bw-marker-card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Hormone' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Kortisol/ })).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/liste.png` })

  // bleibt nach dem Neuladen, auch unter „Auffällige"
  await page.reload()
  await expect(page.locator('[data-bw-flagged]').getByRole('button', { name: /^Kortisol/ })).toBeVisible()
  await expect(page.locator('.bw-marker-card')).toHaveCount(0)
  await page.getByRole('button', { name: 'Rasteransicht' }).click()
  await expect(page.locator('.bw-marker-card')).toHaveCount(1)

  // unter „Befunde" gibt es den Umschalter oben nicht
  await page.getByRole('button', { name: 'Befunde', exact: true }).click()
  await expect(page.locator('[data-bw-layout-toggle]')).toHaveCount(0)
})

test('Raster: Tippen auf die Plakette aendert die Kartengroesse nicht', async ({ page, mock }) => {
  wert(mock, 'Testosteron', { tested_at: '2026-01-10', value: 738, unit: 'ng/dL', ref_min: 349, ref_max: 1110 })
  wert(mock, 'Testosteron', { value: 1310, unit: 'ng/dL', ref_min: 349, ref_max: 1110 })
  wert(mock, 'Kortisol', { value: 14, ref_min: 5, ref_max: 25 })
  await markerAnsicht(page)

  const karten = page.locator('.bw-marker-card')
  await expect(karten).toHaveCount(2)
  const groessen = () => karten.evaluateAll(els => els.map(e => Math.round(e.getBoundingClientRect().height)))
  const vorher = await groessen()
  const plakette = karten.filter({ hasText: 'Testosteron' }).locator('[data-bw-status]')
  // Auf kleinen Bildschirmen liegt die Karte unter dem Rand; erst hinscrollen, dann messen.
  await plakette.scrollIntoViewIfNeeded()
  const breite = (await plakette.boundingBox())!

  // Beide Texte liegen in der Plakette, sichtbar ist immer nur einer
  await expect(plakette.getByText('+572', { exact: true })).toBeVisible()
  await expect(plakette.getByText('349–1.110', { exact: true })).toBeHidden()
  await plakette.click()
  await expect(plakette.getByText('349–1.110', { exact: true })).toBeVisible()
  await expect(plakette.getByText('+572', { exact: true })).toBeHidden()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/plakette-${test.info().project.name}.png` })
  expect(await groessen()).toEqual(vorher)
  // Plakette bleibt neben dem Wert, rutscht nicht darunter
  const danach = (await plakette.boundingBox())!
  expect(Math.abs(danach.y - breite.y)).toBeLessThan(1)
  expect(await plakette.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true)
})

test('Einheiten: rechnet automatisch um, Schalter Konventionell/SI und eigene Wahl je Marker bleiben im Konto', async ({ page, mock }) => {
  wert(mock, 'Testosteron', { tested_at: '2026-01-10', value: 20, unit: 'nmol/L' })
  wert(mock, 'Testosteron', { value: 1310, unit: 'ng/dL', ref_min: 349, ref_max: 1110 })
  await markerAnsicht(page)

  const karte = page.locator('.bw-marker-card').filter({ hasText: 'Testosteron' })
  // nmol/L wird mit dem veroeffentlichten Faktor umgerechnet: Veraenderung statt „—"
  await expect(karte).toContainText('ng/dL')
  await expect(karte.locator('[data-bw-status]')).toHaveAccessibleName(/\+734/)

  await page.getByRole('button', { name: 'SI', exact: true }).click()
  await expect(karte).toContainText('nmol/L')
  await expect(karte).toContainText('45,5')
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/si.png` })
  await expect(karte.locator('[data-bw-status]')).toHaveAccessibleName(/\+25,5/)
  await expect.poll(() => mock.table('profiles')[0].bloodwork_units).toEqual({ system: 'si' })

  // eigene Wahl im Detail
  await karte.getByRole('button', { name: /^Testosteron/ }).click()
  const auswahl = page.getByLabel('Einheit', { exact: true })
  await expect(auswahl).toHaveValue('')
  await expect(auswahl.locator('option')).toHaveText(['Automatisch (nmol/L)', 'ng/dL', 'nmol/L'])
  // eigene Wahl fuer diesen Marker schlaegt den SI-Schalter
  await auswahl.selectOption('ng/dL')
  await expect(page.locator('[data-bw-hero-value]')).toContainText('1.310ng/dL')
  await expect.poll(() => mock.table('profiles')[0].bloodwork_units).toEqual({ system: 'si', marker: { Testosteron: 'ng/dL' } })

  await page.reload()
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SI', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.bw-marker-card').filter({ hasText: 'Testosteron' })).toContainText('ng/dL')
})

test('Hinzufuegen: nur „+", darunter Dokument, Foto und manuelle Eingabe mit eigenem Blutwert und Referenzbereich', async ({ page, mock }) => {
  await page.goto('/blutwerte')
  await expect(page.getByRole('button', { name: 'Import' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Blutwert hinzufügen' }).click()
  const blatt = page.getByRole('dialog', { name: 'Blutwert hinzufügen' })
  await expect(blatt.getByRole('button', { name: /^Dokument/ })).toBeVisible()
  await expect(blatt.getByRole('button', { name: /^Foto/ })).toBeVisible()

  // Foto fuehrt in den Import — zuerst die KI-Einwilligung
  await blatt.getByRole('button', { name: /^Foto/ }).click()
  await expect(page.locator('[data-ai-consent]')).toBeVisible()
  await page.locator('[data-ai-consent]').getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Blutwert hinzufügen' }).click()
  await blatt.getByRole('button', { name: /^Manuelle Eingabe/ }).click()
  await page.getByLabel('Marker', { exact: true }).selectOption({ label: 'Eigener Blutwert …' })
  await page.getByLabel('Name des Blutwerts').fill('Mein Laborwert')
  await page.getByLabel('Wert', { exact: true }).fill('4,2')
  await page.getByLabel('Einheit', { exact: true }).selectOption('U/L')
  await page.getByLabel('von').fill('1')
  await page.getByLabel('bis').fill('3,5')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect.poll(() => mock.table('bloodwork').length).toBe(1)
  expect(mock.table('bloodwork')[0]).toMatchObject({ marker: 'Mein Laborwert', value: 4.2, unit: 'U/L', ref_min: 1, ref_max: 3.5 })
  // mit eigenem Bereich beurteilt: 4,2 liegt darueber
  await expect(page.locator('[data-bw-flagged]')).toContainText('Mein Laborwert')
})

test('Uebersicht: das Datum oben ist der Stand der letzten Messung', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14, ref_min: 5, ref_max: 25 })
  await page.goto('/blutwerte')
  await expect(page.getByText('Stand 15. September')).toBeVisible()
})

test('Uebersicht: nichts auffaellig — Hinweis und Weg zu allen Markern; ohne Werte ein Einstieg', async ({ page, mock }) => {
  await page.goto('/blutwerte')
  await expect(page.locator('[data-bw-flagged-empty]')).toContainText('Noch keine Blutwerte.')
  await expect(page.locator('[data-bw-flagged-count]')).toHaveCount(0)

  wert(mock, 'Kortisol', { value: 14, ref_min: 5, ref_max: 25 })
  await page.reload()
  const leer = page.locator('[data-bw-flagged-empty]')
  await expect(leer).toContainText('Alle zuletzt gemessenen Werte liegen im Referenzbereich.')
  await expect(leer.locator('[data-bw-unchecked]')).toHaveCount(0)
  await leer.getByRole('button', { name: 'Alle Marker ansehen' }).click()
  await expect(page.getByRole('button', { name: 'Alle', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('Uebersicht: Werte ohne Referenzbereich gelten als ungeprueft, nicht als „im Bereich"', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14, ref_min: 5, ref_max: 25 })
  wert(mock, 'Mein Laborwert', { value: 3, unit: 'U/L' })
  await page.goto('/blutwerte')
  const leer = page.locator('[data-bw-flagged-empty]')
  await expect(leer).toContainText('Kein Wert liegt außerhalb seines Referenzbereichs.')
  await expect(leer).not.toContainText('Alle zuletzt gemessenen Werte')
  await expect(leer.locator('[data-bw-unchecked]')).toHaveText('Ohne Referenzbereich, nicht geprüft: 1')
})

test('Uebersicht: Ladefehler sagt nicht „keine Blutwerte", sondern bietet Erneut versuchen', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 30, ref_min: 5, ref_max: 25 })
  let einmal = true
  await page.route('**/rest/v1/bloodwork?*', async route => {
    if (einmal && route.request().method() === 'GET') {
      einmal = false
      return route.fulfill({ status: 500, json: { message: 'kaputt' } })
    }
    return route.fallback()
  })
  await page.goto('/blutwerte')
  const fehler = page.locator('[data-bw-load-error]')
  await expect(fehler).toContainText('Blutwerte konnten nicht geladen werden.')
  await expect(page.getByText('Noch keine Blutwerte.')).toHaveCount(0)
  // auch unter „Alle" kein Raster, als waere nichts gemessen
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await expect(fehler).toBeVisible()
  await fehler.getByRole('button', { name: 'Erneut versuchen' }).click()
  await page.getByRole('button', { name: 'Auffällige (1)' }).click()
  await expect(page.locator('[data-bw-flagged]')).toContainText('Kortisol')
})

test('Loeschen: eigenes Sheet statt Browser-Fenster; Abbrechen laesst den Wert stehen', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14 })
  let browserFenster = false
  page.on('dialog', dialog => { browserFenster = true; void dialog.dismiss() })

  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  // Loeschen sitzt im Bearbeiten-Fenster der Messung
  await messungBearbeiten(page, '14 µg/dL vom 15.09.2026')
  await page.locator('[data-bw-entry-delete]').click()

  const sheet = page.getByRole('alertdialog', { name: 'Wert löschen?' })
  await expect(sheet).toContainText('Kortisol vom 15.09.2026 wird entfernt.')
  await sheet.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('bloodwork')).toHaveLength(1)

  // Abbrechen fuehrt zurueck ins Formular, von dort erneut loeschen
  await page.getByRole('button', { name: 'Wert löschen' }).click()
  await page.locator('[data-bw-delete-confirm]').click()
  await expect(page.getByText('Blutwert gelöscht')).toBeVisible()
  expect(mock.table('bloodwork')).toHaveLength(0)
  expect(browserFenster).toBe(false)
})

test('Bearbeiten: Einzelwert aendert Datum, Wert und Einheit', async ({ page, mock }) => {
  const eintrag = wert(mock, 'Kortisol', { value: 14, notes: 'nuechtern' })
  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await messungBearbeiten(page, '14 µg/dL vom 15.09.2026')

  await expect(page.getByRole('heading', { name: 'Wert bearbeiten' })).toBeVisible()
  // Marker ist fest, kein Auswahlfeld
  await expect(page.locator('#bw-entry-marker')).toHaveCount(0)
  await page.locator('[data-app-modal] input[type="date"]').fill('2026-09-14')
  await page.getByLabel('Wert', { exact: true }).fill('16,5')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Wert geändert')).toBeVisible()
  const [zeile] = mock.table('bloodwork')
  expect(zeile).toMatchObject({ id: eintrag.id, tested_at: '2026-09-14', value: 16.5, unit: 'µg/dL', notes: 'nuechtern' })
  // erneut geoeffnet: Dezimalkomma wie eingegeben
  await messungBearbeiten(page, '16,5 µg/dL vom 14.09.2026')
  await expect(page.getByLabel('Wert', { exact: true })).toHaveValue('16,5')
})

test('Bearbeiten: Wert aus einem Befund — Datum bleibt beim Befund, Referenz bleibt', async ({ page, mock }) => {
  const befund = mock.insert('bloodwork_reports', { user_id: TEST_USER.id, tested_at: '2026-09-15', lab_name: null, source: 'import' })
  wert(mock, 'Kortisol', { value: 14, report_id: befund.id, ref_min: 5, ref_max: 25 })
  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/liste.png`, fullPage: true })
  await messungBearbeiten(page, '14 µg/dL vom 15.09.2026')

  const datum = page.locator('[data-app-modal] input[type="date"]')
  await expect(datum).toBeDisabled()
  await expect(page.getByText('Das Datum gehört zum Befund, aus dem der Wert stammt.')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/bearbeiten.png` })
  await page.getByLabel('Wert', { exact: true }).fill('20')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Wert geändert')).toBeVisible()
  expect(mock.table('bloodwork')[0]).toMatchObject({ tested_at: '2026-09-15', value: 20, report_id: befund.id, ref_min: 5, ref_max: 25 })
})

test('Bearbeiten: andere Einheit — Laborreferenz faellt weg, mit Hinweis', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14, ref_min: 5, ref_max: 25 })
  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await messungBearbeiten(page, '14 µg/dL vom 15.09.2026')

  await expect(page.locator('[data-bw-unit-drops-range]')).toHaveCount(0)
  await page.getByLabel('Wert', { exact: true }).fill('386')
  await page.locator('[data-app-modal]').getByLabel('Einheit', { exact: true }).selectOption('nmol/L')
  await expect(page.locator('[data-bw-unit-drops-range]')).toContainText('Die Laborreferenz gilt für µg/dL.')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Wert geändert')).toBeVisible()
  expect(mock.table('bloodwork')[0]).toMatchObject({ value: 386, unit: 'nmol/L', ref_min: null, ref_max: null })
})

test('Verlauf: Zyklen aus My Stack als Balken hinter dem Verlauf', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-06-10' })
  const tb = mock.table('stack_items').find(row => row.display_name === 'TB-500')!
  Object.assign(mock.table('cycles').find(row => row.stack_item_id === tb.id)!, {
    active: false, ended_at: '2026-07-20T00:00:00.000Z', end_local_date: '2026-07-20',
  })
  wert(mock, 'Kortisol', { tested_at: '2026-05-15', value: 18 })
  wert(mock, 'Kortisol', { tested_at: '2026-09-15', value: 12 })

  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  // Die Balken liegen im Canvas; darunter je Substanz ein Chip zum Ein-/Ausblenden
  const streifen = page.locator('[data-cycle-strip]')
  await expect(streifen.locator('[data-cycle-row]')).toHaveCount(2)
  await expect(streifen.locator('[data-cycle-row]').first()).toContainText('TB-500')
  const tb500 = streifen.getByRole('button', { name: 'TB-500: 10.06.2026 – 19.07.2026' })
  const bpc = streifen.getByRole('button', { name: 'BPC-157: 01.08.2026 – läuft' })
  // anfangs keiner an; der erste Chip weist mit einem Puls darauf hin
  await expect(tb500).toHaveAttribute('aria-pressed', 'false')
  await expect(bpc).toHaveAttribute('aria-pressed', 'false')
  await expect(streifen.locator('[data-cycle-hint]')).toHaveCount(1)
  await expect(tb500).toHaveAttribute('data-cycle-hint', '')
  // Antippen blendet ein (mehrere moeglich), erneutes Tippen wieder aus; der Puls ist danach weg
  await bpc.click()
  await expect(streifen.locator('[data-cycle-hint]')).toHaveCount(0)
  await tb500.click()
  await expect(tb500).toHaveAttribute('aria-pressed', 'true')
  await expect(bpc).toHaveAttribute('aria-pressed', 'true')
  await tb500.click()
  await expect(tb500).toHaveAttribute('aria-pressed', 'false')
  await expect(streifen.locator('[data-cycle-hint]')).toHaveCount(0)
  // neu in die Detailansicht: wieder nichts gewaehlt, der Puls ist zurueck
  await page.getByRole('button', { name: 'Zurück' }).click()
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await expect(streifen.getByRole('button', { name: 'BPC-157: 01.08.2026 – läuft' })).toHaveAttribute('aria-pressed', 'false')
  await expect(streifen.locator('[data-cycle-hint]')).toHaveCount(1)
  await expect(streifen.locator('[data-cycle-note]')).toContainText('Zeitliche Nähe ist kein Beleg für eine Wirkung.')
  await expect(streifen.locator('[data-cycle-note]')).not.toContainText('weitere')

  if (process.env.SCREENSHOT_DIR) {
    await page.waitForTimeout(1600) // Linien-Animation abwarten
    for (const thema of ['dark', 'light']) {
      await page.evaluate(wert => document.documentElement.setAttribute('data-theme', wert), thema)
      await streifen.locator('..').screenshot({ path: `${process.env.SCREENSHOT_DIR}/verlauf-${thema}.png` })
    }
  }
})

test('Detail: „Aktuell“, Wert, Abstand zur Grenze, ohne Kennzahlen, zugeklappte Hinweise, Messungen, Quellen ganz unten', async ({ page, mock }) => {
  const befund = mock.insert('bloodwork_reports', { user_id: TEST_USER.id, tested_at: '2026-09-15', lab_name: 'Labor Mitte', source: 'import' })
  wert(mock, 'Testosteron', { tested_at: '2026-04-12', value: 980, unit: 'ng/dL' })
  wert(mock, 'Testosteron', { value: 1310, unit: 'ng/dL', ref_min: 349, ref_max: 1110, report_id: befund.id })
  await markerAnsicht(page)
  await page.locator('.bw-marker-card').filter({ hasText: 'Testosteron' }).getByRole('button', { name: /^Testosteron/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Testosteron' })).toBeVisible()
  await expect(page.locator('[data-bw-hero-value]')).toContainText('1.310ng/dL')
  // Kasten oben wie in der ersten Fassung: Wert, Veraenderung, Referenzbalken, Plakette
  const kasten = page.locator('[data-bw-hero]')
  await expect(kasten.locator('[data-bw-hero-label]')).toHaveText('Aktuell')
  await expect(kasten).toContainText('330')
  await expect(kasten).toContainText('349–1.110 ng/dL (Labor)')
  await expect(page.locator('[data-bw-status]')).toHaveText('200 ng/dL über dem Bereich')
  await expect(page.getByRole('img', { name: /Testosteron/ })).toBeVisible()

  const zeitraum = page.getByRole('group', { name: 'Zeitraum' })
  await expect(zeitraum.getByRole('button')).toHaveText(['3M', '6M', '1J', '2J', 'Alles'])
  await expect(zeitraum.getByRole('button', { name: '1J' })).toHaveAttribute('aria-pressed', 'true')

  await expect(page.getByRole('region', { name: 'Kennzahlen' })).toHaveCount(0)

  // Hinweise und Ursachen: nur „Wenn der Wert zu niedrig ist“ und „Wenn der Wert zu hoch ist“, nie von selbst aufgeklappt
  const einordnung = page.locator('[data-bw-guidance]')
  await expect(page.getByRole('heading', { name: 'Hinweise und Ursachen' })).toBeVisible()
  await expect(einordnung.getByRole('button')).toHaveText(['Wenn der Wert zu niedrig ist', 'Wenn der Wert zu hoch ist'])
  for (const name of ['Wenn der Wert zu niedrig ist', 'Wenn der Wert zu hoch ist']) {
    await expect(einordnung.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false')
  }
  await einordnung.getByRole('button', { name: 'Wenn der Wert zu hoch ist' }).click()
  await expect(einordnung).toContainText('Mögliche Ursachen')

  // Quellen: ganz unten, eingeklappt
  const quellen = page.locator('[data-bw-sources]')
  await expect(quellen.locator('summary')).toHaveText('Quellen (6)')
  const link = page.getByRole('link', { name: 'gesundheitsinformation.de: Testosteron' })
  await expect(link).toBeHidden()
  await quellen.locator('summary').click()
  await expect(link).toHaveAttribute('href', /gesundheitsinformation\.de/)
  const reihenfolge = await page.evaluate(() => {
    const q = document.querySelector('[data-bw-sources]')!
    const m = document.getElementById('bw-history-title')!
    return !!(m.compareDocumentPosition(q) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(reihenfolge).toBe(true)

  // Messungen: anfangs zugeklappt, die Anzahl steht trotzdem da
  const messungen = page.getByRole('region', { name: 'Messungen' })
  const kopf = messungen.locator('[data-bw-history-toggle]')
  await expect(kopf).toHaveAttribute('aria-expanded', 'false')
  await expect(messungen.locator('[data-bw-measurement-count]')).toHaveText('2')
  await expect(messungen.locator('[data-bw-entry]')).toHaveCount(0)
  await kopf.click()
  const zeilen = messungen.locator('[data-bw-entry]')
  await expect(zeilen).toHaveCount(2)
  await expect(zeilen.first()).toContainText('Befund · Labor Mitte')
  await expect(zeilen.first()).toContainText('+330')
  await expect(zeilen.last()).toContainText('Manuell')
  await expect(zeilen.last()).toContainText('Erstwert')
  // Antippen oeffnet erst die kleine Detailansicht, nicht das Formular
  await zeilen.first().click()
  await expect(zeilen.first()).toHaveAttribute('aria-expanded', 'true')
  const detail = messungen.locator('[data-bw-entry-detail]')
  await expect(detail).toHaveCount(1)
  await expect(detail.locator('[data-bw-entry-value]')).toContainText('1.310')
  await expect(detail).toContainText('+330 ng/dL seit der vorigen')
  await expect(detail).toContainText('200 ng/dL über dem Bereich')
  await expect(page.locator('[data-app-modal]')).toHaveCount(0)
  // eine andere Messung: die erste klappt zu
  await zeilen.last().click()
  await expect(detail).toHaveCount(1)
  await expect(zeilen.first()).toHaveAttribute('aria-expanded', 'false')
  await expect(detail).toContainText('Erstwert')
  if (process.env.SCREENSHOT_DIR) {
    await page.waitForTimeout(900)
    for (const thema of ['dark', 'light']) {
      await page.evaluate(wert => document.documentElement.setAttribute('data-theme', wert), thema)
      await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/detail-${thema}.png`, fullPage: true })
    }
  }
})

test('Loeschen aus dem Formular: Abbrechen fuehrt mit den Eingaben zurueck', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14 })
  await markerAnsicht(page)
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await messungBearbeiten(page, '14 µg/dL vom 15.09.2026')
  await page.getByLabel('Wert', { exact: true }).fill('15')
  await page.getByRole('button', { name: 'Wert löschen' }).click()
  await page.getByRole('alertdialog', { name: 'Wert löschen?' }).getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.getByRole('heading', { name: 'Wert bearbeiten' })).toBeVisible()
  await expect(page.getByLabel('Wert', { exact: true })).toHaveValue('15')
  expect(mock.table('bloodwork')).toHaveLength(1)
})

test('Detail: Zeitraum steht ueber dem Graph; Werte ausserhalb rot, innerhalb gruen', async ({ page, mock }) => {
  for (const [tested_at, value] of [['2025-11-12', 290], ['2026-01-20', 520], ['2026-04-12', 980], ['2026-06-15', 1340], ['2026-09-15', 1310]] as const) {
    wert(mock, 'Testosteron', { tested_at, value, unit: 'ng/dL', ref_min: 349, ref_max: 1110 })
  }
  await markerAnsicht(page)
  await page.locator('.bw-marker-card').filter({ hasText: 'Testosteron' }).getByRole('button', { name: /^Testosteron/ }).click()
  const zeitraum = page.getByRole('group', { name: 'Zeitraum' })
  const graph = page.getByRole('img', { name: /Testosteron/ })
  await expect(graph).toBeVisible()
  // Leiste liegt oberhalb des Graphen
  expect((await zeitraum.boundingBox())!.y).toBeLessThan((await graph.boundingBox())!.y)
  if (process.env.SCREENSHOT_DIR) {
    await graph.scrollIntoViewIfNeeded()
    await page.waitForTimeout(900)
    for (const thema of ['dark', 'light']) {
      await page.evaluate(wert => document.documentElement.setAttribute('data-theme', wert), thema)
      await page.waitForTimeout(100)
      await graph.locator('..').locator('..').screenshot({ path: `${process.env.SCREENSHOT_DIR}/bw-zonen-${thema}.png` })
    }
  }
})

test('Detail-Kopf: Kategorie hinter dem Namen, Kurzerklaerung ausgeschrieben, langer Name laeuft', async ({ page, mock }) => {
  wert(mock, 'Testosteron', { value: 600, unit: 'ng/dL' })
  wert(mock, 'Alkalische Phosphatase', { value: 80, unit: 'U/L' })
  await markerAnsicht(page)
  await page.getByRole('button', { name: /Testosteron/ }).first().click()

  const name = page.locator('[data-bw-name]')
  await expect(page.getByRole('heading', { level: 1, name: 'Testosteron' })).toBeVisible()
  const kategorie = page.locator('[data-bw-kategorie]')
  await expect(kategorie).toHaveText('Hormone')
  // Gleiche Zeile, dicht dahinter
  const n = (await name.boundingBox())!
  const k = (await kategorie.boundingBox())!
  expect(Math.abs((k.y + k.height) - (n.y + n.height))).toBeLessThan(12)
  expect(k.x - (n.x + n.width)).toBeLessThan(16)
  await expect(name).not.toHaveAttribute('data-bw-name-laeuft')

  // Kurzerklaerung oben, ganz ausgeschrieben; kein „mehr“
  const intro = page.locator('[data-bw-intro]')
  await expect(intro).toContainText('Das wichtigste männliche Sexualhormon')
  await expect(intro).toContainText('Muskelabbau zeigen.')
  await expect(page.getByRole('button', { name: 'mehr' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Hinweise und Ursachen' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Was bedeutet der Wert?' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Zurück' }).click()
  await page.getByRole('button', { name: /Alkalische Phosphatase/ }).first().click()
  await expect(page.locator('[data-bw-name]')).toHaveAttribute('data-bw-name-laeuft', 'true')
  await expect(page.locator('[data-bw-kategorie]')).toBeInViewport()
})

test.describe('weniger Bewegung', () => {
  test('langer Name laeuft nicht, sondern wird gekuerzt', async ({ page, mock }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    wert(mock, 'Alkalische Phosphatase', { value: 80, unit: 'U/L' })
    await markerAnsicht(page)
    await page.getByRole('button', { name: /Alkalische Phosphatase/ }).first().click()
    const name = page.locator('[data-bw-name]')
    await expect(name).toBeVisible()
    await expect(name).not.toHaveAttribute('data-bw-name-laeuft')
    await expect(name).toHaveCSS('text-overflow', 'ellipsis')
  })
})
