import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { RpcError, TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/**
 * Tagebuch v2: Eintrag mit Titel, optionaler Substanz und Chips (Wirkungen,
 * Nebenwirkungen) mit eigener Intensitaet und Dauer — Tabelle effect_symptoms.
 */

type Felder = Record<string, unknown>

/** Ein Eintrag; ohne Angabe mit einem Chip „Kopfschmerzen", 4 · 2 Std. */
function eintrag(mock: MockSupabase, felder: Felder, chips: Felder[] = [{}]) {
  const effect = mock.insert('effects', {
    user_id: TEST_USER.id, type: 'side_effect', description: 'Kopfschmerz', severity: 4,
    status: 'eingetreten', duration: null, occurred_at: '2026-09-27T08:00:00.000Z',
    notes: null, stack_item_id: null, dose_log_id: null, ...felder,
  })
  chips.forEach((chip, position) => mock.insert('effect_symptoms', {
    user_id: TEST_USER.id, effect_id: effect.id, symptom_key: 'headache', custom_label: null, kind: 'side_effect',
    severity: 4, duration_minutes: 120, ongoing: false, position, ...chip,
  }))
  return effect
}

const formular = (page: Page) => page.getByRole('dialog', { name: /^(Neuer Tagebuch-Eintrag|Eintrag bearbeiten)$/ })

/** Chip im Formular antippen, im Editor eine Stufe waehlen, „Fertig". */
async function waehleChip(page: Page, name: string, stufe: number, art: 'Wirkungen' | 'Nebenwirkungen' = 'Nebenwirkungen') {
  await formular(page).getByRole('tab', { name: new RegExp(`^${art}`) }).click()
  await formular(page).getByRole('button', { name: new RegExp(`^${name}, `) }).click()
  const editor = page.getByRole('dialog', { name, exact: true })
  await editor.getByRole('button', { name: new RegExp(`^${stufe} – `) }).click()
  await editor.getByRole('button', { name: 'Fertig' }).click()
  await expect(editor).toBeHidden()
}

test('Neu: Titel und ein Chip mit Intensitaet und Dauer — gespeichert in effects und effect_symptoms', async ({ page, mock }) => {
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  await expect(dialog.getByLabel('Titel')).toBeFocused()
  await dialog.getByLabel('Titel').fill('Morgens')

  await dialog.getByRole('button', { name: /^Mehr Energie, / }).click()
  const editor = page.getByRole('dialog', { name: 'Mehr Energie' })
  // Ein neuer Chip hat noch keine Intensitaet — „Fertig" wartet darauf.
  await expect(editor.getByRole('button', { name: 'Fertig' })).toBeDisabled()
  await expect(editor.getByRole('button', { name: '1 – Sehr leicht' })).toBeFocused()
  await editor.getByRole('button', { name: '4 – Stark' }).click()
  await editor.getByRole('group', { name: 'Dauer' }).getByRole('button', { name: 'Dauer' }).click()
  const zahl = editor.getByRole('spinbutton', { name: 'Dauer, Zahl' })
  await expect(zahl).toHaveAttribute('aria-valuetext', '1')
  await zahl.press('ArrowDown')
  await expect(zahl).toHaveAttribute('aria-valuetext', '2')
  await expect(editor.getByRole('spinbutton', { name: 'Dauer, Einheit' })).toHaveAttribute('aria-valuetext', 'Std.')
  await editor.getByRole('button', { name: 'Fertig' }).click()

  await expect(dialog.getByRole('button', { name: 'Mehr Energie, Wirkung, Intensität 4, Dauer 2 Std.' })).toBeFocused()
  await expect(dialog.getByRole('tab', { name: /^Wirkungen/ })).toContainText('1')
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag gespeichert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  const effect = mock.table('effects')[0]
  expect(effect).toMatchObject({ description: 'Morgens', type: 'effect', severity: 4, duration: null, stack_item_id: null })
  expect(mock.table('effect_symptoms')).toHaveLength(1)
  expect(mock.table('effect_symptoms')[0]).toMatchObject({
    effect_id: effect.id, symptom_key: 'more_energy', custom_label: null, kind: 'effect',
    severity: 4, duration_minutes: 120, ongoing: false, position: 0,
  })
  await expect(page.locator('ul > li')).toContainText('Mehr Energie, Wirkung, Intensität 4, Dauer 2 Std.')
})

test('Neu: Speichern erst mit Titel und Chip; der Hinweis sagt, was fehlt', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  const speichern = dialog.getByRole('button', { name: 'Speichern' })
  await expect(speichern).toBeDisabled()
  await expect(dialog).toContainText('Titel eingeben und mindestens eine Wirkung oder Nebenwirkung wählen')
  await dialog.getByLabel('Titel').fill('Abends')
  await expect(dialog).toContainText('Mindestens eine Wirkung oder Nebenwirkung wählen')
  await waehleChip(page, 'Übelkeit', 2)
  await expect(speichern).toBeEnabled()
  await dialog.getByLabel('Titel').fill('')
  await expect(dialog).toContainText('Noch einen Titel eingeben')
  await expect(speichern).toBeDisabled()
})

test('Neu: mehrere Chips, eigene Nebenwirkung, „Haelt noch an"; Art am Eintrag nur, wenn einheitlich', async ({ page, mock }) => {
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  await dialog.getByLabel('Titel').fill('Nach dem Training')
  await waehleChip(page, 'Mehr Kraft', 3, 'Wirkungen')

  await dialog.getByRole('tab', { name: /^Nebenwirkungen/ }).click()
  await dialog.getByRole('button', { name: '+ Eigene Nebenwirkung' }).click()
  const editor = page.getByRole('dialog').filter({ has: page.getByLabel('Name', { exact: true }) })
  await expect(editor.getByLabel('Name', { exact: true })).toBeFocused()
  await editor.getByLabel('Name', { exact: true }).fill('Ziehen im Nacken')
  await editor.getByRole('button', { name: '2 – Leicht' }).click()
  await editor.getByRole('button', { name: 'Hält noch an' }).click()
  await editor.getByRole('button', { name: 'Fertig' }).click()
  await expect(dialog.getByRole('button', { name: 'Ziehen im Nacken, Nebenwirkung, Intensität 2, Dauer hält an' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  expect(mock.table('effects')[0]).toMatchObject({ type: null, severity: 3 })
  expect(mock.table('effect_symptoms').map(({ symptom_key, custom_label, kind, severity, duration_minutes, ongoing, position }) =>
    ({ symptom_key, custom_label, kind, severity, duration_minutes, ongoing, position }))).toEqual([
    { symptom_key: 'more_strength', custom_label: null, kind: 'effect', severity: 3, duration_minutes: null, ongoing: false, position: 0 },
    { symptom_key: null, custom_label: 'Ziehen im Nacken', kind: 'side_effect', severity: 2, duration_minutes: null, ongoing: true, position: 1 },
  ])
  await expect(page.locator('ul > li')).toContainText('Ziehen im Nacken, Nebenwirkung, Intensität 2, Dauer hält an')
})

test('Chip-Suche zeigt Wirkungen und Nebenwirkungen; ohne Treffer ein Hinweis', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  await dialog.getByRole('searchbox', { name: 'Wirkung oder Nebenwirkung suchen' }).fill('schlaf')
  await expect(dialog).toContainText('Die Suche zeigt Wirkungen und Nebenwirkungen.')
  await expect(dialog.getByRole('button', { name: /^Besser geschlafen, Wirkung/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Schlechter geschlafen, Nebenwirkung/ })).toBeVisible()
  await expect(dialog.getByRole('button', { name: /^Übelkeit, / })).toHaveCount(0)
  await dialog.getByRole('searchbox').fill('xyz')
  await expect(dialog).toContainText('Nichts gefunden.')
})

test('Chip-Editor: Escape schliesst nur den Editor, Fokus zurueck auf den Chip; Info erklaert den Aufbau', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  await dialog.getByRole('tab', { name: /^Nebenwirkungen/ }).click()
  const chip = dialog.getByRole('button', { name: /^Schwindel, / })
  await chip.click()
  await expect(page.getByRole('dialog', { name: 'Schwindel' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Schwindel' })).toBeHidden()
  await expect(dialog).toBeVisible()
  await expect(chip).toBeFocused()

  await dialog.getByRole('button', { name: 'So funktionieren die Chips' }).click()
  const info = page.getByRole('dialog', { name: 'So ist ein Chip aufgebaut' })
  await expect(info).toBeVisible()
  // Fokus liegt auf „Verstanden", ohne dass der Titel aus dem Bild scrollt.
  await expect(info.getByRole('button', { name: 'Verstanden' })).toBeFocused()
  await expect(info.getByRole('heading', { name: 'So ist ein Chip aufgebaut' })).toBeInViewport({ ratio: 1 })
  await info.getByRole('button', { name: 'Verstanden' }).click()
  await expect(info).toBeHidden()
  await expect(dialog).toBeVisible()
})

test('Bearbeiten: vorbefuellt; Chip aendern, entfernen, hinzufuegen aendert den Eintrag statt einen neuen anzulegen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { stack_item_id: item.id }, [{}, { symptom_key: 'nausea', severity: 2, duration_minutes: null, position: 1 }])
  await page.goto('/tagebuch')

  await expect(page.getByText('Kopfschmerz', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  const dialog = formular(page)
  await expect(dialog.getByRole('heading', { name: 'Eintrag bearbeiten' })).toBeVisible()
  await expect(dialog.getByLabel('Titel')).toHaveValue('Kopfschmerz')
  await expect(dialog.getByLabel('Substanz')).toHaveValue(String(item.id))
  await expect(dialog.locator('.lg-form-value')).toHaveText('BPC-157')
  await expect(dialog.getByRole('tab', { name: /^Nebenwirkungen/ })).toContainText('2')

  await dialog.getByRole('tab', { name: /^Nebenwirkungen/ }).click()
  await dialog.getByRole('button', { name: 'Kopfschmerzen, Nebenwirkung, Intensität 4, Dauer 2 Std.' }).click()
  const editor = page.getByRole('dialog', { name: 'Kopfschmerzen' })
  await expect(editor.getByRole('button', { name: '4 – Stark' })).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.getByRole('button', { name: '4 – Stark' })).toBeFocused()
  await editor.getByRole('button', { name: '1 – Sehr leicht' }).click()
  await editor.getByRole('button', { name: 'Fertig' }).click()

  await dialog.getByRole('button', { name: /^Übelkeit, Nebenwirkung, Intensität 2/ }).click()
  await page.getByRole('dialog', { name: 'Übelkeit' }).getByRole('button', { name: 'Entfernen' }).click()
  await waehleChip(page, 'Besser geschlafen', 5, 'Wirkungen')

  await dialog.getByLabel('Titel').fill('Kopfschmerz, leichter')
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag aktualisiert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Kopfschmerz, leichter', type: null, severity: 5, stack_item_id: item.id })
  const chips = mock.table('effect_symptoms')
  expect(chips).toHaveLength(2)
  // Ein Aufruf ersetzt alle Chips des Eintrags, in der Reihenfolge des Formulars.
  expect(mock.rpcCalls.filter(call => call.name === 'save_diary_entry')).toHaveLength(1)
  expect(chips.map(({ symptom_key, kind, severity, duration_minutes, position }) => ({ symptom_key, kind, severity, duration_minutes, position }))).toEqual([
    { symptom_key: 'headache', kind: 'side_effect', severity: 1, duration_minutes: 120, position: 0 },
    { symptom_key: 'slept_better', kind: 'effect', severity: 5, duration_minutes: null, position: 1 },
  ])
})

test('Scheitert das Speichern, meldet die App den Fehler und das Formular bleibt offen (Alles-oder-nichts prueft der SQL-Trockenlauf)', async ({ page, mock }) => {
  eintrag(mock, {})
  mock.onRpc('save_diary_entry', () => { throw new RpcError('effect_symptoms_symptom_key_check') })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  const dialog = formular(page)
  await dialog.getByLabel('Titel').fill('Geändert')
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Fehler beim Speichern', { exact: false })).toBeVisible()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Speichern' })).toBeEnabled()
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Kopfschmerz' })
  expect(mock.table('effect_symptoms')).toHaveLength(1)
})

test('Bearbeiten: ein alter Eintrag ohne Chips wird zu einem eigenen Chip', async ({ page, mock }) => {
  eintrag(mock, { description: 'Unruhig', type: 'side_effect', severity: 2, duration: 'std_2' }, [])
  await page.goto('/tagebuch')
  // Die Liste zeigt ihn wie bisher: Art, Intensitaet, Dauer.
  await expect(page.locator('ul > li')).toContainText('Nebenwirkung')
  await expect(page.locator('ul > li')).toContainText('2 Std')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  const dialog = formular(page)
  await dialog.getByRole('tab', { name: /^Nebenwirkungen/ }).click()
  await expect(dialog.getByRole('button', { name: 'Unruhig, Nebenwirkung, Intensität 2' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Speichern' }).click()
  await expect(dialog).toBeHidden()
  expect(mock.table('effect_symptoms')).toHaveLength(1)
  expect(mock.table('effect_symptoms')[0]).toMatchObject({ symptom_key: null, custom_label: 'Unruhig', kind: 'side_effect', severity: 2 })
  expect(mock.table('effects')[0]).toMatchObject({ duration: null })
})

test('Neu nach Bearbeiten: das Formular ist leer und legt einen neuen Eintrag an', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await page.getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Neu' }).click()
  await expect(page.getByRole('heading', { name: 'Neuer Tagebuch-Eintrag' })).toBeVisible()
  await expect(formular(page).getByLabel('Titel')).toHaveValue('')
  await expect(formular(page).getByRole('tab', { name: /^Nebenwirkungen/ })).not.toContainText(/\d/)
})

test('Loeschen: der Eintrag und seine Chips sind weg', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag löschen?' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
  await expect(page.locator('ul > li')).toHaveCount(0)
  expect(mock.table('effects')).toHaveLength(0)
  expect(mock.table('effect_symptoms')).toHaveLength(0)
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

test('Suche und Filter laufen in der Datenbank: Titel oder Substanzname; Filter nach Art der Chips', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { description: 'Besserer Schlaf', type: 'effect', occurred_at: '2026-09-27T09:00:00.000Z' }, [{ symptom_key: 'slept_better', kind: 'effect' }])
  eintrag(mock, { description: 'Rötung', stack_item_id: item.id, occurred_at: '2026-09-27T08:30:00.000Z' }, [{ symptom_key: 'redness' }])
  eintrag(mock, { description: 'Gemischt', type: null }, [{ symptom_key: 'more_energy', kind: 'effect' }, { symptom_key: 'fatigue', position: 1 }])
  await page.goto('/tagebuch')
  await expect(page.locator('ul > li')).toHaveCount(3)

  await page.getByRole('searchbox').fill('bpc')
  await expect(page.locator('ul > li')).toHaveCount(1)
  await expect(page.locator('ul > li')).toContainText('Rötung')

  await page.getByRole('searchbox').fill('')
  await page.getByRole('button', { name: 'Wirkungen', exact: true }).click()
  await expect(page.locator('ul > li')).toHaveCount(2)
  await expect(page.locator('ul > li').first()).toContainText('Besserer Schlaf')
  await expect(page.locator('ul > li').last()).toContainText('Gemischt')
  // Ein Eintrag mit beiden Arten erscheint einmal, mit allen seinen Chips — getrennt nach Art.
  const gemischt = page.locator('ul > li').last()
  await expect(gemischt.locator('[data-tagebuch-art]')).toHaveCount(2)
  await expect(gemischt.locator('[data-tagebuch-art="effect"]')).toContainText('Wirkungen')
  await expect(gemischt.locator('[data-tagebuch-art="effect"]')).toContainText('Mehr Energie, Wirkung')
  await expect(gemischt.locator('[data-tagebuch-art="side_effect"]')).toContainText('Nebenwirkungen')
  await expect(gemischt.locator('[data-tagebuch-art="side_effect"]')).toContainText('Müdigkeit, Nebenwirkung')

  await page.getByRole('button', { name: 'Nebenwirkungen', exact: true }).click()
  await expect(page.locator('ul > li')).toHaveCount(2)
  await expect(page.locator('ul > li').first()).toContainText('Rötung')
})

test('Barrierefreiheit: Formular ist ein Dialog, Escape schliesst, Tabs per Pfeiltaste', async ({ page, mock }) => {
  void mock
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = page.getByRole('dialog', { name: 'Neuer Tagebuch-Eintrag' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Titel')).toBeFocused()
  const wirkungen = dialog.getByRole('tab', { name: /^Wirkungen/ })
  await expect(wirkungen).toHaveAttribute('aria-selected', 'true')
  await wirkungen.focus()
  await page.keyboard.press('ArrowRight')
  await expect(dialog.getByRole('tab', { name: /^Nebenwirkungen/ })).toBeFocused()
  await expect(dialog.getByRole('tab', { name: /^Nebenwirkungen/ })).toHaveAttribute('aria-selected', 'true')
  await expect(dialog.getByRole('tabpanel')).toContainText('Einstichstelle')
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
  await dialog.getByLabel('Titel').fill('Halb getippt')

  let frage = ''
  page.once('dialog', d => { frage = d.message(); void d.dismiss() })
  await page.keyboard.press('Escape')
  await expect.poll(() => frage).toBe('Ungespeicherte Änderungen verwerfen?')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Titel')).toHaveValue('Halb getippt')

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
  await dialog.getByLabel('Titel').fill('Wärme an der Einstichstelle')
  await waehleChip(page, 'Rötung', 2)
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
  await dialog.getByLabel('Titel').fill('Ohne Bezug')
  await waehleChip(page, 'Rötung', 2)
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
  await formular(page).getByLabel('Titel').fill('Kopfschmerz, leicht')
  await formular(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(formular(page)).toBeHidden()
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
    const severity = 1 + (i % 5)
    eintrag(mock, {
      description: i % 2 ? 'Rötung' : 'Besserer Schlaf', type: i % 2 ? 'side_effect' : 'effect', severity,
      stack_item_id: log.stack_item_id, dose_log_id: log.id,
      occurred_at: new Date(Date.parse(`${tag}T06:00:00.000Z`) + [0.5, 2, 6, 18, 30][i % 5] * 3_600_000).toISOString(),
    }, [i % 2 ? { symptom_key: 'redness', severity } : { symptom_key: 'slept_better', kind: 'effect', severity }])
  })
  eintrag(mock, { description: 'Müdigkeit', occurred_at: '2026-09-25T12:00:00.000Z' }, [{ symptom_key: 'fatigue' }])
  eintrag(mock, { description: 'Rötung', type: 'side_effect', stack_item_id: bpc.id, occurred_at: '2026-09-26T12:00:00.000Z' }, [{ symptom_key: 'redness' }])
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
  await formular(page).getByLabel('Titel').fill('Mehr Energie')
  await waehleChip(page, 'Mehr Energie', 3, 'Wirkungen')
  await formular(page).getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('[data-tagebuch-substanzen] tbody tr')).toHaveCount(1)
  await expect(page.locator('[data-tagebuch-substanzen] tbody tr')).toContainText('Ohne Substanz')
})

test('Auswertung: gezaehlt wird je Chip — ein gemischter Eintrag zaehlt als Wirkung und als Nebenwirkung', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const bpc = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { description: 'Nach dem Training', type: null, stack_item_id: bpc.id }, [
    { symptom_key: 'more_strength', kind: 'effect', severity: 2 },
    { symptom_key: 'nausea', severity: 4, position: 1 },
  ])
  eintrag(mock, { description: 'Abends', stack_item_id: bpc.id, occurred_at: '2026-09-26T08:00:00.000Z' }, [{ symptom_key: 'nausea', severity: 3 }])
  await page.goto('/tagebuch')
  await page.getByRole('tab', { name: 'Auswertung' }).click()
  const panel = page.locator('[data-tagebuch-auswertung]')
  await expect(panel.getByRole('heading', { name: 'Wirkungen und Nebenwirkungen pro Woche' })).toBeVisible()
  const zeile = page.locator('[data-tagebuch-substanzen] tbody tr').first()
  // Wirkungen 1, Nebenwirkungen 2, Ø Intensität (2 + 4 + 3) / 3 = 3
  await expect(zeile).toContainText('BPC-157')
  await expect(zeile.locator('td')).toHaveText(['1', '2', '3,0'])
  await expect(page.locator('[data-tagebuch-substanzen] tbody tr').nth(1)).toHaveText('Häufigste Nebenwirkung: Übelkeit (2×)')
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
  eintrag(mock, { stack_item_id: bpc.id, notes: 'Eine längere Notiz, die über mehrere Zeilen läuft, damit die Karte deutlich höher wird als die Knöpfe.' }, [{}, { symptom_key: 'nausea', position: 1 }, { symptom_key: 'dizziness', position: 2, ongoing: true, duration_minutes: null }])
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

test('Liste: lange Chips bleiben in ihrer Spalte und verdecken die Knoepfe nicht', async ({ page, mock }, info) => {
  eintrag(mock, {}, ['headache', 'trouble_falling_asleep', 'breast_tenderness', 'injection_sting', 'tingling_numbness']
    .map((symptom_key, position) => ({ symptom_key, position, duration_minutes: 2880 })))
  await page.goto('/tagebuch')
  const karte = page.locator('ul > li').first()
  const knoepfe = (await karte.getByRole('button', { name: 'Eintrag bearbeiten' }).boundingBox())!
  // Rechte Kante jedes Chips links vom ersten Knopf.
  const rechts = await karte.locator('[data-tagebuch-chip]').evaluateAll(els => els.map(el => el.getBoundingClientRect().right))
  expect(rechts).toHaveLength(5)
  expect(Math.max(...rechts)).toBeLessThanOrEqual(knoepfe.x)
  if (info.project.name === 'iphone-se') await page.screenshot({ path: info.outputPath('liste-lang.png') })
  await karte.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await expect(formular(page)).toBeVisible()
})

test('Formular: Speichern ist ohne Scrollen sichtbar; Suche und Tabs bleiben beim Scrollen oben', async ({ page, mock }, info) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  const dialog = formular(page)
  const speichern = dialog.getByRole('button', { name: 'Speichern' })
  await expect(speichern).toBeInViewport({ ratio: 1 })

  // Ein fokussiertes Feld am Ende verschwindet nicht hinter der festen Knopfleiste.
  await dialog.getByLabel('Notizen (optional)').focus()
  const feld = (await dialog.getByLabel('Notizen (optional)').boundingBox())!
  const leiste = (await speichern.boundingBox())!
  expect(feld.y + feld.height).toBeLessThanOrEqual(leiste.y)
  await expect(dialog.getByRole('searchbox')).toBeInViewport()
  await expect(dialog.getByRole('tab', { name: /^Wirkungen/ })).toBeInViewport()

  await dialog.getByLabel('Titel').fill('Unruhe')
  await waehleChip(page, 'Innere Unruhe', 4)
  await waehleChip(page, 'Klarer Kopf', 2, 'Wirkungen')
  if (info.project.name === 'iphone-se') await page.screenshot({ path: info.outputPath('form.png') })
  if (info.project.name === 'iphone-13') {
    await formular(page).getByRole('button', { name: /^Klarer Kopf, / }).click()
    await page.screenshot({ path: info.outputPath('chip-editor.png') })
    await page.keyboard.press('Escape')
  }
  await speichern.click()
  await expect(dialog).toBeHidden()
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Unruhe', severity: 4 })
  if (info.project.name === 'iphone-13') await page.screenshot({ path: info.outputPath('liste-chips.png') })
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
