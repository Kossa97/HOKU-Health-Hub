import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/** Tagebuch: Eintraege anlegen, bearbeiten, loeschen — und Fehler sichtbar machen. */

function eintrag(mock: MockSupabase, felder: Record<string, unknown>) {
  return mock.insert('effects', {
    user_id: TEST_USER.id, type: 'side_effect', description: 'Kopfschmerz', severity: 2,
    status: 'eingetreten', duration: '2 Std', occurred_at: '2026-09-27T08:00:00.000Z',
    notes: null, stack_item_id: null, dose_log_id: null, ...felder,
  })
}

test('Bearbeiten: Formular ist vorbefuellt (auch alte Dauer-Texte), Speichern aendert den Eintrag statt einen neuen anzulegen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { stack_item_id: item.id })
  await page.goto('/tagebuch')

  await expect(page.getByText('Kopfschmerz')).toBeVisible()
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await expect(page.getByRole('heading', { name: 'Eintrag bearbeiten' })).toBeVisible()

  await expect(page.locator('input[value="Kopfschmerz"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '2 Std', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('dialog').getByLabel('Substanz')).toHaveValue(String(item.id))
  // Der Wert steht sichtbar rechts in der Zeile
  await expect(page.getByRole('dialog').locator('.lg-form-value')).toHaveText('BPC-157')

  await page.locator('input[value="Kopfschmerz"]').fill('Leichter Kopfschmerz')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag aktualisiert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  expect(mock.table('effects')[0]).toMatchObject({
    description: 'Leichter Kopfschmerz', severity: 2, duration: 'std_2', stack_item_id: item.id, status: 'eingetreten',
  })
  await expect(page.getByText('Leichter Kopfschmerz')).toBeVisible()
})

test('Bearbeiten: eine eigene Dauer erscheint im Freitextfeld', async ({ page, mock }) => {
  eintrag(mock, { duration: '3 Tage, schwankend' })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await expect(page.locator('input[value="3 Tage, schwankend"]')).toBeVisible()
})

test('Neu nach Bearbeiten: das Formular ist leer und legt einen neuen Eintrag an', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await page.getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Neu' }).click()
  await expect(page.getByRole('heading', { name: 'Neuer Tagebuch-Eintrag' })).toBeVisible()
  await expect(page.locator('input[value="Kopfschmerz"]')).toHaveCount(0)
})

test('Loeschen: der Eintrag ist weg', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag löschen?' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByText('Kopfschmerz')).toHaveCount(0)
  expect(mock.table('effects')).toHaveLength(0)
})

test('Neu: eine vorgegebene Dauer wird als Schluessel gespeichert und uebersetzt angezeigt', async ({ page, mock }) => {
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  await page.getByLabel('Beschreibung *').fill('Mehr Energie')
  await page.getByRole('button', { name: '4 Std', exact: true }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag gespeichert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Mehr Energie', duration: 'std_4' })
  await expect(page.getByText('4 Std')).toBeVisible()
})

test('Anzeige: ein schon umgestellter Eintrag zeigt die Uebersetzung, Freitext bleibt Freitext', async ({ page, mock }) => {
  eintrag(mock, { description: 'A', duration: 'woche_1', occurred_at: '2026-09-27T08:00:00.000Z' })
  eintrag(mock, { description: 'B', duration: 'mal so, mal so', occurred_at: '2026-09-26T08:00:00.000Z' })
  await page.goto('/tagebuch')
  await expect(page.getByText('1 Woche')).toBeVisible()
  await expect(page.getByText('mal so, mal so')).toBeVisible()
  await expect(page.getByText('woche_1')).toHaveCount(0)
})

test('Seitenweise: zuerst 50 Eintraege, „Weitere Eintraege laden" holt den Rest', async ({ page, mock }) => {
  for (let i = 0; i < 60; i++) {
    eintrag(mock, { description: `Eintrag ${String(i).padStart(2, '0')}`, occurred_at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString() })
  }
  await page.goto('/tagebuch')
  const liste = page.locator('ul > li')
  await expect(liste).toHaveCount(50)
  await expect(liste.first()).toContainText('Eintrag 59')
  await page.getByRole('button', { name: 'Weitere Einträge laden' }).click()
  await expect(liste).toHaveCount(60)
  await expect(liste.last()).toContainText('Eintrag 00')
  await expect(page.getByRole('button', { name: 'Weitere Einträge laden' })).toHaveCount(0)
})

test('Suche und Filter laufen in der Datenbank: Beschreibung oder Substanzname', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { description: 'Besserer Schlaf', type: 'effect' })
  eintrag(mock, { description: 'Rötung', stack_item_id: item.id })
  eintrag(mock, { description: 'Müdigkeit' })
  await page.goto('/tagebuch')
  await expect(page.locator('ul > li')).toHaveCount(3)

  await page.getByRole('searchbox').fill('bpc')
  await expect(page.locator('ul > li')).toHaveCount(1)
  await expect(page.locator('ul > li')).toContainText('Rötung')

  await page.getByRole('searchbox').fill('')
  await page.getByRole('button', { name: 'Wirkungen', exact: true }).click()
  await expect(page.locator('ul > li')).toHaveCount(1)
  await expect(page.locator('ul > li')).toContainText('Besserer Schlaf')
})

test('Barrierefreiheit: Formular ist ein Dialog, Escape schliesst, Felder sind beschriftet', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Tagebuch-Eintrag' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Beschreibung *')).toBeFocused()
  await expect(dialog.getByRole('button', { name: 'Wirkung', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('Loeschen-Sheet: Abbrechen behaelt den Eintrag', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag löschen?' }).click()
  const sheet = page.getByRole('alertdialog', { name: 'Eintrag löschen?' })
  await expect(sheet).toContainText('Kopfschmerz')
  await expect(sheet.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await sheet.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('effects')).toHaveLength(1)
})

test('Escape nach einer Eingabe fragt nach; „Nein" laesst das Formular offen', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Tagebuch-Eintrag' })
  await dialog.getByLabel('Beschreibung *').fill('Halb getippt')

  let frage = ''
  page.once('dialog', d => { frage = d.message(); void d.dismiss() })
  await page.keyboard.press('Escape')
  await expect.poll(() => frage).toBe('Ungespeicherte Änderungen verwerfen?')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Beschreibung *')).toHaveValue('Halb getippt')

  page.once('dialog', d => void d.accept())
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

function einnahme(mock: MockSupabase, stackItemId: unknown, logged_at: string, felder: Record<string, unknown> = {}) {
  return mock.insert('dose_logs', {
    user_id: TEST_USER.id, stack_item_id: stackItemId, dose: 250, unit: 'mcg', taken: true, logged_at, ...felder,
  })
}

test('Einnahme: freiwillig, nur bestaetigte der Substanz vor dem Zeitpunkt, wird gespeichert und angezeigt', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  const tb = mock.table('stack_items').find(row => row.display_name === 'TB-500')!
  const passend = einnahme(mock, bpc.id, '2026-09-28T06:00:00.000Z')
  einnahme(mock, bpc.id, '2026-09-27T06:00:00.000Z')
  einnahme(mock, bpc.id, '2026-09-28T05:00:00.000Z', { taken: false })
  einnahme(mock, bpc.id, '2026-09-28T09:00:00.000Z')
  einnahme(mock, tb.id, '2026-09-28T07:00:00.000Z')
  await page.goto('/tagebuch')

  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Bezug zur Einnahme (optional)')).toHaveCount(0)
  await dialog.getByLabel('Beschreibung *').fill('Wärme an der Einstichstelle')
  await dialog.getByLabel('Substanz').selectOption({ label: 'BPC-157' })

  const auswahl = dialog.getByLabel('Bezug zur Einnahme (optional)')
  await expect(auswahl).toHaveValue('')
  await expect(auswahl.locator('option')).toHaveCount(3)
  await auswahl.selectOption(String(passend.id))
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()

  expect(mock.table('effects')[0]).toMatchObject({ stack_item_id: bpc.id, dose_log_id: passend.id })
  await expect(page.locator('[data-tagebuch-intake]')).toHaveText('2 h nach Einnahme · 250 mcg')
})

test('Einnahme: ohne Wahl wird nichts verknuepft; Substanzwechsel leert die Wahl', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  const log = einnahme(mock, bpc.id, '2026-09-28T06:00:00.000Z')
  await page.goto('/tagebuch')

  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Beschreibung *').fill('Ohne Bezug')
  await dialog.getByLabel('Substanz').selectOption({ label: 'BPC-157' })
  await dialog.getByLabel('Bezug zur Einnahme (optional)').selectOption(String(log.id))
  await dialog.getByLabel('Substanz').selectOption({ label: 'TB-500' })
  await expect(dialog.getByText('Keine bestätigte Einnahme vor diesem Zeitpunkt.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  expect(mock.table('effects')[0]).toMatchObject({ dose_log_id: null })
  await expect(page.locator('[data-tagebuch-intake]')).toHaveCount(0)
})

test('Einnahme: ohne Substanz bleibt ein bestehender Verweis beim Speichern erhalten', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  const log = einnahme(mock, bpc.id, '2026-09-28T06:00:00.000Z')
  // So hinterlaesst es die Datenbank, wenn die Substanz geloescht wurde.
  eintrag(mock, { stack_item_id: null, dose_log_id: log.id, occurred_at: '2026-09-28T07:00:00.000Z' })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await page.getByRole('dialog').getByLabel('Beschreibung *').fill('Kopfschmerz, leicht')
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Kopfschmerz, leicht', dose_log_id: log.id })
})

test('Einnahme: eine Einnahme aus derselben Minute ist waehlbar', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  // NOW ist 10:00:00 Berlin; die Einnahme 10:00:40 — dieselbe Minute wie der vorbelegte Zeitpunkt.
  const log = einnahme(mock, bpc.id, '2026-09-28T08:00:40.000Z')
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  await page.getByRole('dialog').getByLabel('Substanz').selectOption({ label: 'BPC-157' })
  await expect(page.getByRole('dialog').getByLabel('Bezug zur Einnahme (optional)').locator(`option[value="${log.id}"]`)).toHaveCount(1)
})

test('Einnahme: beim Bearbeiten bleibt eine aeltere Verknuepfung gewaehlt', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  const alt = einnahme(mock, bpc.id, '2026-09-20T06:00:00.000Z')
  for (let tag = 21; tag <= 27; tag++) einnahme(mock, bpc.id, `2026-09-${tag}T06:00:00.000Z`)
  eintrag(mock, { stack_item_id: bpc.id, dose_log_id: alt.id, occurred_at: '2026-09-27T12:00:00.000Z' })
  await page.goto('/tagebuch')
  await expect(page.locator('[data-tagebuch-intake]')).toHaveText('7 Tage nach Einnahme · 250 mcg')

  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  const auswahl = page.getByRole('dialog').getByLabel('Bezug zur Einnahme (optional)')
  await expect(auswahl).toHaveValue(String(alt.id))
  await expect(auswahl.locator('option')).toHaveCount(7)
})

function auswertungsDaten(mock: MockSupabase) {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  const tb = mock.table('stack_items').find(row => row.display_name === 'TB-500')!
  const tage = ['2026-09-02', '2026-09-03', '2026-09-09', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-23', '2026-09-27']
  tage.forEach((tag, i) => {
    const log = einnahme(mock, i % 3 === 0 ? tb.id : bpc.id, `${tag}T06:00:00.000Z`)
    eintrag(mock, {
      description: i % 2 ? 'Rötung' : 'Besserer Schlaf', type: i % 2 ? 'side_effect' : 'effect', severity: 1 + (i % 5),
      stack_item_id: log.stack_item_id, dose_log_id: log.id,
      occurred_at: new Date(Date.parse(`${tag}T06:00:00.000Z`) + [0.5, 2, 6, 18, 30][i % 5] * 3_600_000).toISOString(),
    })
  })
  eintrag(mock, { description: 'Müdigkeit', occurred_at: '2026-09-25T12:00:00.000Z' })
  eintrag(mock, { description: 'Rötung', type: 'side_effect', stack_item_id: bpc.id, occurred_at: '2026-09-26T12:00:00.000Z' })
}

test('Auswertung: Reiter, Verlauf, Abstand zur Einnahme, Tabelle pro Substanz', async ({ page, mock }, info) => {
  auswertungsDaten(mock)
  await page.goto('/tagebuch')
  await page.getByRole('tab', { name: 'Auswertung' }).click()
  await expect(page.getByRole('tab', { name: 'Auswertung' })).toHaveAttribute('aria-selected', 'true')
  const panel = page.locator('[data-tagebuch-auswertung]')
  await expect(panel.getByText('Zeigt Häufungen in deinen Einträgen', { exact: false })).toBeVisible()

  // 4 Wochen: KW 37–40 (07.09.–04.10.), die Einträge vom 2./3.9. liegen davor.
  const verlauf = panel.locator('table.sr-only').first()
  await expect(verlauf.locator('tbody tr')).toHaveCount(4)
  await expect(verlauf.locator('tbody tr').first()).toContainText('KW 37')

  await expect(panel.getByText('Nur Einträge mit Bezug zu einer Einnahme (6)')).toBeVisible()

  const tabelle = panel.locator('[data-tagebuch-substanzen] tbody tr')
  // Je Substanz eine Zeile mit Zahlen, darunter die haeufigste Nebenwirkung.
  const zeilen = page.locator('[data-tagebuch-substanzen] tbody th[scope=row]')
  await expect(zeilen).toHaveText(['BPC-157', 'TB-500', 'Ohne Substanz'])
  // Alle drei haben eine Nebenwirkung: je Substanz zwei Zeilen, die zweite gehoert zur ersten.
  await expect(tabelle).toHaveCount(6)
  await expect(tabelle.nth(1)).toHaveText('Häufigste Nebenwirkung: Rötung (3×)')
  await expect(tabelle.nth(5)).toHaveText('Häufigste Nebenwirkung: Müdigkeit (1×)')
  const bezug = await tabelle.nth(1).locator('td').getAttribute('headers')
  await expect(page.locator(`[id="${bezug}"]`)).toHaveText('BPC-157')

  await panel.getByRole('button', { name: 'Alles' }).click()
  await expect(panel.getByText('Nur Einträge mit Bezug zu einer Einnahme (8)')).toBeVisible()

  if (info.project.name === 'iphone-13') {
    // Balken wachsen animiert ein — erst nach der Animation fotografieren.
    await page.waitForTimeout(1600)
    await page.screenshot({ path: info.outputPath('auswertung-dunkel.png'), fullPage: true })
    const graph = panel.getByRole('img').first()
    const box = (await graph.boundingBox())!
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6)
    await page.screenshot({ path: info.outputPath('auswertung-tooltip.png') })
  }
})

test('Auswertung: ein neuer Eintrag erscheint sofort, ohne den Reiter zu wechseln', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('tab', { name: 'Auswertung' }).click()
  await expect(page.getByText('Keine Einträge in diesem Zeitraum.')).toBeVisible()
  await page.getByRole('button', { name: 'Neu' }).click()
  await page.getByRole('dialog').getByLabel('Beschreibung *').fill('Mehr Energie')
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('[data-tagebuch-substanzen] tbody tr')).toHaveCount(1)
  await expect(page.locator('[data-tagebuch-substanzen] tbody tr')).toContainText('Ohne Substanz')
})

test('Auswertung: ohne Eintraege ein Hinweis statt leerer Diagramme', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('tab', { name: 'Auswertung' }).click()
  await expect(page.getByText('Keine Einträge in diesem Zeitraum.')).toBeVisible()
})

test('Liste: Bearbeiten und Loeschen sitzen vertikal mittig in der Karte', async ({ page, mock }, info) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { stack_item_id: bpc.id, notes: 'Eine längere Notiz, die über mehrere Zeilen läuft, damit die Karte deutlich höher wird als die Knöpfe.', duration: 'std_2' })
  eintrag(mock, { description: 'Kurz', occurred_at: '2026-09-26T08:00:00.000Z' })
  await page.goto('/tagebuch')
  await expect(page.locator('ul > li')).toHaveCount(2)
  for (const karte of await page.locator('ul > li').all()) {
    const box = (await karte.boundingBox())!
    const knopf = (await karte.getByRole('button', { name: 'Eintrag löschen?' }).boundingBox())!
    const mitteKarte = box.y + box.height / 2
    const mitteKnopf = knopf.y + knopf.height / 2
    expect(Math.abs(mitteKarte - mitteKnopf)).toBeLessThan(2)
  }
  if (info.project.name === 'iphone-13') await page.screenshot({ path: info.outputPath('liste.png') })
})

test('Formular: Speichern ist ohne Scrollen sichtbar; Intensitaet per Stufe waehlbar', async ({ page, mock }, info) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog')
  const speichern = dialog.getByRole('button', { name: 'Speichern' })
  await expect(speichern).toBeInViewport({ ratio: 1 })

  const stufen = dialog.getByRole('group', { name: 'Intensität' })
  await expect(stufen.getByRole('radio', { name: '3 – Mittel' })).toBeChecked()
  await stufen.getByText('4', { exact: true }).click()
  await expect(stufen.getByRole('radio', { name: '4 – Stark' })).toBeChecked()
  await expect(stufen).toContainText('Stark')

  // Ein fokussiertes Feld am Ende verschwindet nicht hinter der festen Knopfleiste.
  await dialog.getByLabel('Notizen (optional)').focus()
  const feld = (await dialog.getByLabel('Notizen (optional)').boundingBox())!
  const leiste = (await speichern.boundingBox())!
  expect(feld.y + feld.height).toBeLessThanOrEqual(leiste.y)

  await dialog.getByLabel('Beschreibung *').fill('Unruhe')
  if (info.project.name === 'iphone-se') await page.screenshot({ path: info.outputPath('form.png') })
  await speichern.click()
  await expect(dialog).toBeHidden()
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Unruhe', severity: 4 })
})

test('Auswertung: Tabellenkopf nennt Wirkung und Nebenwirkung in Worten', async ({ page, mock }, info) => {
  auswertungsDaten(mock)
  await page.goto('/tagebuch')
  await page.getByRole('tab', { name: 'Auswertung' }).click()
  const kopf = page.locator('[data-tagebuch-substanzen] thead')
  await expect(kopf).toContainText('Wirk.')
  await expect(kopf).toContainText('Neben.')
  await expect(page.locator('[data-tagebuch-substanzen]').getByRole('columnheader', { name: 'Nebenwirkungen' })).toHaveCount(1)
  // Passt ohne seitliches Scrollen auf das kleinste Geraet.
  const breite = await page.locator('[data-tagebuch-substanzen]').evaluate(el => [el.scrollWidth, el.parentElement!.clientWidth])
  expect(breite[0]).toBeLessThanOrEqual(breite[1])
  if (info.project.name === 'iphone-se') {
    await page.locator('[data-tagebuch-substanzen]').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath('tabelle.png') })
  }
})
