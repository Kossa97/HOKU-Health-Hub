import type { Locator } from '@playwright/test'
import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/**
 * Bewertungen v2: eine Bewertung haengt an einem Zyklus. Zeitraum, Dauer
 * und Dosis stehen von selbst da; nichts ist vorbelegt; Teilen ist aus.
 */

function bewertung(mock: MockSupabase, name: string, felder: Record<string, unknown>) {
  const item = mock.table('stack_items').find(row => row.display_name === name)!
  return mock.insert('reviews', {
    user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: null, rating: 4, title: '', body: null, pros: null, cons: null,
    experience: 'gut', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: false,
    created_at: '2026-09-01T10:00:00.000Z', updated_at: null, ...felder,
  })
}

/** Die Auswahlzeile im Sheet (unsichtbares `<select>` unter der Zeile). */
const auswahl = (sheet: Locator, name: 'Substanz' | 'Zyklus') => sheet.getByRole('combobox', { name })

/** Den Zyklus der Substanz beenden — so, wie „Zyklus beenden" ihn hinterlaesst. */
function beende(mock: MockSupabase, name: string, endeExklusiv: string): string {
  const item = mock.table('stack_items').find(row => row.display_name === name)!
  const cycle = mock.table('cycles').find(row => row.stack_item_id === item.id)!
  Object.assign(cycle, { active: false, ended_at: `${endeExklusiv}T00:00:00.000Z`, end_local_date: endeExklusiv })
  return String(cycle.id)
}

test('Bewerten: nichts vorbelegt, Substanz und Fazit sind Pflicht, der beendete Zyklus kommt mit der Substanz', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  await page.goto('/bewertungen')

  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await expect(sheet).toBeVisible()

  // Nichts vorbelegt: keine Substanz, kein Zyklus, kein Stern — Speichern sagt, was fehlt.
  await expect(auswahl(sheet, 'Substanz')).toHaveValue('')
  await expect(auswahl(sheet, 'Zyklus')).toBeDisabled()
  await expect(sheet.getByRole('radiogroup', { name: 'Fazit' }).getByRole('radio', { checked: true })).toHaveCount(0)
  const speichern = sheet.getByRole('button', { name: 'Speichern' })
  await expect(speichern).toHaveAttribute('aria-disabled', 'true')
  const fehlt = sheet.locator('[data-review-missing]')
  await expect(fehlt).toHaveText('Zum Speichern Substanz und Fazit wählen.')
  await expect(sheet.locator('[data-review-public]')).not.toBeChecked()
  // Ein Tipp aufs gesperrte Speichern markiert, was fehlt (gesperrt heisst
  // aria-disabled — Playwright tippt dann nur mit force).
  await speichern.click({ force: true })
  await expect(fehlt).toHaveClass(/lg-bad-text/)
  expect(mock.table('reviews')).toHaveLength(0)

  // Mit der Substanz kommt ihr beendeter Zyklus — mit allem, was dabei war.
  await auswahl(sheet, 'Substanz').selectOption({ label: 'BPC-157' })
  await expect(auswahl(sheet, 'Zyklus')).toHaveValue(zyklus)
  const kontext = sheet.locator('[data-review-context]')
  await expect(kontext).toContainText('12.08.2026 – 19.09.2026')
  await expect(kontext).toContainText('6 Wochen')
  await expect(kontext).toContainText('250 mcg')
  await expect(fehlt).toHaveText('Zum Speichern Fazit wählen.')

  await sheet.getByRole('radio', { name: 'Wirkung: 5 / 5' }).click()
  await sheet.getByRole('radio', { name: 'Verträglichkeit: 4 / 5' }).click()
  await sheet.getByRole('radio', { name: 'Ja' }).click()
  await sheet.getByLabel('Notiz', { exact: true }).fill('Schnell gemerkt.')
  await sheet.getByRole('radio', { name: '4 Sterne' }).click()
  await expect(sheet.locator('[data-review-verdict-word]')).toHaveText('Gut')
  await expect(fehlt).toHaveCount(0)
  await speichern.click()
  await expect(sheet).toBeHidden()

  expect(mock.table('reviews')).toHaveLength(1)
  expect(mock.table('reviews')[0]).toMatchObject({
    cycle_id: zyklus, rating: 4, experience: 'gut', wirkung: 5, vertraeglichkeit: 4, wieder_nehmen: 'ja',
    title: '', body: 'Schnell gemerkt.', is_public: false,
  })
  await expect(page.locator('[data-review-criteria]')).toHaveText('Wirkung 5/5 · Verträglichkeit 4/5 · Wieder nehmen? Ja')
  await expect(page.locator('[data-review-cycle]')).toContainText('2026')

  // Fuer denselben Zyklus gibt es keine zweite: er steht als „festgehalten" gesperrt.
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const zweites = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await auswahl(zweites, 'Substanz').selectOption({ label: 'BPC-157' })
  await expect(auswahl(zweites, 'Zyklus').locator('option', { hasText: 'festgehalten' })).toHaveJSProperty('disabled', true)
  await expect(auswahl(zweites, 'Zyklus')).toHaveValue('')
})

test('Bewerten: eine alte Bewertung ohne Zyklus bekommt den passenden vorgeschlagen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  mock.insert('reviews', {
    user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: null, rating: 3, title: 'Alt', body: null, pros: null, cons: null,
    experience: 'mittel', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: false,
    created_at: '2026-09-01T10:00:00.000Z', updated_at: null,
  })
  await page.goto('/bewertungen')
  await expect(page.getByText('Alt', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: /^Erfahrung bearbeiten: BPC-157/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Erfahrung bearbeiten' })
  // Die alten Sterne sind da; der Zyklus vom 01.09. ist vorgeschlagen.
  await expect(sheet.getByRole('radio', { name: '3 Sterne' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.locator('[data-review-context]')).toContainText('12.08.2026')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('reviews')[0]).toMatchObject({ cycle_id: zyklus, rating: 3, title: 'Alt' })
})

test('Übersicht: je Substanz gruppiert, mit Schnitt; Wischen und eigenes Lösch-Sheet', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01' })
  const zyklus = beende(mock, 'BPC-157', '2026-09-20')
  bewertung(mock, 'BPC-157', { cycle_id: zyklus, rating: 5, title: 'Stark', created_at: '2026-09-21T10:00:00.000Z' })
  bewertung(mock, 'BPC-157', { rating: 2, title: 'Frueher', created_at: '2026-03-01T10:00:00.000Z' })
  bewertung(mock, 'TB-500', { rating: 4, title: 'Solide' })
  await page.goto('/bewertungen')

  // Erfahrungen, keine Produktbewertung: der Hinweis steckt im ⓘ neben dem Titel.
  await expect(page.getByRole('heading', { name: 'Erfahrungen', level: 1 })).toBeVisible()
  await expect(page.locator('[data-review-disclaimer]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Was sind Erfahrungen?' }).click()
  await expect(page.locator('[data-review-disclaimer]')).toContainText('keine Empfehlung')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-review-disclaimer]')).toHaveCount(0)
  const bpc = page.locator('section[data-review-group]', { has: page.getByRole('heading', { name: 'BPC-157' }) })
  await expect(bpc).toContainText('3,5')
  await expect(bpc).toContainText('2 Einträge')
  // Der Zyklus zuerst, die alte ohne Zyklus dahinter.
  await expect(bpc.locator('[data-review-cycle]')).toHaveText([/2026/, 'Ohne Zyklus'])

  // Nach links wischen: Loeschen fragt im eigenen Sheet — kein Browser-Fenster.
  page.on('dialog', () => { throw new Error('Browser-Dialog statt Sheet') })
  const zeile = bpc.locator('[data-review-row]').first()
  const box = (await zeile.boundingBox())!
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(box.x + box.width * 0.7 - 30 * i, box.y + box.height / 2)
  await page.mouse.up()
  await zeile.getByRole('button', { name: 'Löschen' }).click()
  const frage = page.getByRole('alertdialog', { name: 'Erfahrung löschen?' })
  await expect(frage).toContainText('BPC-157')
  // Abbrechen hat den Fokus: Enter loescht nichts.
  await expect(frage.getByRole('button', { name: 'Abbrechen' })).toBeFocused()
  await frage.getByRole('button', { name: 'Löschen' }).click()
  await expect(frage).toBeHidden()
  expect(mock.table('reviews').map(row => row.title).sort()).toEqual(['Frueher', 'Solide'])
  await expect(bpc).toContainText('1 Eintrag')
})

test('Übersicht: Ladefehler steht da, mit „Erneut versuchen"', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  bewertung(mock, 'BPC-157', { title: 'Da' })
  await page.route('**/rest/v1/reviews*', route => route.fulfill({ status: 500, json: { message: 'kaputt' } }), { times: 1 })
  await page.goto('/bewertungen')
  const fehler = page.getByRole('alert')
  await expect(fehler).toContainText('Erfahrungen konnten nicht geladen werden')
  await fehler.getByRole('button', { name: 'Erneut versuchen' }).click()
  await expect(fehler).toBeHidden()
  await expect(page.getByText('Da', { exact: true })).toBeVisible()
})

test('My Stack: endgültig löschen sagt, wie viele Bewertungen mitgehen', async ({ page, mock }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  bewertung(mock, 'BPC-157', { title: 'Eins' })
  bewertung(mock, 'BPC-157', { title: 'Zwei' })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  await page.getByRole('dialog', { name: 'BPC-157' }).getByRole('button', { name: 'Löschen' }).click()
  await expect(page.getByRole('dialog', { name: 'Substanz entfernen' }).locator('[data-delete-reviews]'))
    .toHaveText('Auch 2 Erfahrungen dieser Substanz werden gelöscht.')
})

test('Ohne Zyklus: eine Substanz ohne Plan lässt sich bewerten — und eine mit Plan auch allgemein', async ({ page, mock }) => {
  seedPeptide(mock, 'Magnesium', {
    startDate: '2026-09-01', category: 'supplement', plan: false,
    form: { dosage_form: 'tablet', zutat: { amount_value: 400, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' } },
  })
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  await page.goto('/bewertungen')

  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await auswahl(sheet, 'Substanz').selectOption({ label: 'Magnesium' })
  await expect(auswahl(sheet, 'Zyklus')).toHaveValue('')
  await expect(sheet.locator('[data-review-general]')).toHaveText('Für diese Substanz gibt es noch keinen Zyklus — der Eintrag wird ohne gespeichert.')
  await sheet.getByRole('radio', { name: '4 Sterne' }).click()
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()

  // Mit Plan: „Ohne Zyklus" gilt allgemein — und geht beliebig oft.
  for (const sterne of ['3 Sterne', '5 Sterne']) {
    await page.getByRole('button', { name: 'Neu', exact: true }).click()
    const weitere = page.getByRole('dialog', { name: 'Neue Erfahrung' })
    await auswahl(weitere, 'Substanz').selectOption({ label: 'BPC-157' })
    await auswahl(weitere, 'Zyklus').selectOption({ label: 'Ohne Zyklus' })
    await expect(weitere.locator('[data-review-general]')).toHaveText('Gilt für die Substanz allgemein, nicht für einen bestimmten Zeitraum.')
    await expect(weitere.locator('[data-review-context]')).toHaveCount(0)
    await weitere.getByRole('radio', { name: sterne }).click()
    await weitere.getByRole('button', { name: 'Speichern' }).click()
    await expect(weitere).toBeHidden()
  }
  expect(mock.table('reviews').map(row => row.cycle_id)).toEqual([null, null, null])
})

test('Übersicht: kein Hinweis auf noch nicht bewertete Zyklen mehr', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  beende(mock, 'BPC-157', '2026-09-20')
  await page.goto('/bewertungen')
  await expect(page.getByText('Noch keine Erfahrungen festgehalten')).toBeVisible()
  await expect(page.getByText(/noch ohne Erfahrung/)).toHaveCount(0)
})

test('Plan beenden in My Stack fragt einmal „Wie war\'s?" — Bewerten führt zum richtigen Zyklus', async ({ page, mock }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await detail.getByRole('button', { name: /Plan & Verlauf öffnen/ }).click()
  await page.getByRole('button', { name: 'Beenden', exact: true }).last().click()
  await page.getByRole('button', { name: 'Plan beenden' }).last().click()

  const frage = page.locator('[data-review-prompt]')
  await expect(frage).toContainText('Zyklus BPC-157 beendet — festhalten, wie es dir ging?')
  await frage.getByRole('button', { name: 'Festhalten' }).click()

  await expect(page).toHaveURL(/\/bewertungen$/)
  const sheet = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await expect(auswahl(sheet, 'Substanz').locator('option:checked')).toHaveText('BPC-157')
  await expect(sheet.locator('[data-review-context]')).toContainText('12.08.2026')
})

test('Öffentliches Profil: nur freigegebene Bewertungen, ohne Alter und Dosis; privat sieht aus wie unbekannt', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  Object.assign(mock.table('profiles')[0], { username: 'anna', display_name: 'Anna', public_bio: 'Ich teste.', is_public: true, age: 33 })
  bewertung(mock, 'BPC-157', { title: 'Geteilt', rating: 5, wirkung: 4, is_public: true, created_at: '2026-09-21T10:00:00.000Z' })
  bewertung(mock, 'BPC-157', { title: 'Privat', rating: 1, is_public: false })

  await page.goto('/u/anna')
  await expect(page.getByRole('heading', { name: 'Anna' })).toBeVisible()
  await expect(page.locator('[data-public-review]')).toHaveCount(1)
  await expect(page.locator('[data-review-disclaimer]')).toContainText('keine Empfehlung')
  await expect(page.locator('[data-public-review]')).toContainText('Geteilt')
  await expect(page.locator('[data-public-review]')).toContainText('Wirkung 4/5')
  await expect(page.locator('[data-public-review]')).toContainText('September 2026')
  await expect(page.getByText('Privat', { exact: true })).toHaveCount(0)
  await expect(page.getByText('33')).toHaveCount(0)
  await expect(page.getByText('250 mcg')).toHaveCount(0)

  // Privat und unbekannt: dieselbe Antwort.
  mock.table('profiles')[0].is_public = false
  await page.goto('/u/anna')
  await expect(page.getByText('Profil nicht verfügbar')).toBeVisible()
  await page.goto('/u/gibtsnicht')
  await expect(page.getByText('Profil nicht verfügbar')).toBeVisible()
})

test('Sheet: mit Eingaben wippt der erste Tipp daneben, der zweite fragt; das Kreuz fragt sofort', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  beende(mock, 'BPC-157', '2026-09-20')
  await page.goto('/bewertungen')
  page.on('dialog', () => { throw new Error('Browser-Dialog statt Sheet') })

  // Unveraendert: ein Tipp auf den abgedunkelten Rand schliesst.
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await page.mouse.click(10, 10)
  await expect(sheet).toBeHidden()

  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  await auswahl(sheet, 'Substanz').selectOption({ label: 'BPC-157' })

  // Seitlich ueber die Sterne wischen setzt die Wertung.
  const sterne = sheet.getByRole('radiogroup', { name: 'Fazit' })
  await sterne.scrollIntoViewIfNeeded()
  const erster = (await sterne.getByRole('radio', { name: '1 Stern' }).boundingBox())!
  const vierter = (await sterne.getByRole('radio', { name: '4 Sterne' }).boundingBox())!
  const y = erster.y + erster.height / 2
  await page.mouse.move(erster.x + erster.width / 2, y)
  await page.mouse.down()
  for (let i = 1; i <= 6; i++) await page.mouse.move(erster.x + erster.width / 2 + ((vierter.x - erster.x) * i) / 6, y)
  await page.mouse.up()
  await expect(sterne.getByRole('radio', { name: '4 Sterne' })).toHaveAttribute('aria-checked', 'true')

  // Erster Tipp daneben: das Sheet bleibt. Zweiter: die Rueckfrage.
  const frage = page.getByRole('alertdialog', { name: 'Änderungen verwerfen?' })
  await page.mouse.click(10, 10)
  await expect(sheet).toBeVisible()
  await expect(frage).toHaveCount(0)
  await page.mouse.click(10, 10)
  await expect(frage).toBeVisible()
  await expect(frage.getByRole('button', { name: 'Weiter bearbeiten' })).toBeFocused()
  await frage.getByRole('button', { name: 'Weiter bearbeiten' }).click()
  await expect(frage).toHaveCount(0)
  await expect(sterne.getByRole('radio', { name: '4 Sterne' })).toHaveAttribute('aria-checked', 'true')

  // Das Kreuz fragt sofort.
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(frage).toBeVisible()
  await frage.getByRole('button', { name: 'Weiter bearbeiten' }).click()

  // Positiv und Negativ in Tabs; der Punkt zeigt, wo schon Text steht. Teilen ist ein Schalter.
  await sheet.getByRole('tab', { name: 'Positiv' }).click()
  await sheet.getByRole('textbox', { name: 'Positiv' }).fill('Schnell')
  await sheet.getByRole('tab', { name: 'Negativ' }).click()
  await sheet.getByRole('textbox', { name: 'Negativ' }).fill('Teuer')
  await expect(sheet.locator('[data-review-tab-filled]')).toHaveCount(2)
  await expect(sheet.getByRole('switch', { name: 'Im öffentlichen Profil zeigen' })).toHaveAttribute('aria-checked', 'false')

  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('reviews')[0]).toMatchObject({ rating: 4, pros: 'Schnell', cons: 'Teuer', is_public: false })

  // Verwerfen schliesst ohne zu speichern.
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  await sheet.getByLabel('Notiz', { exact: true }).fill('Doch nicht')
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await frage.getByRole('button', { name: 'Verwerfen' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('reviews')).toHaveLength(1)
})

test('Übersicht: Reihenfolge im Menü, „geschrieben am" unten in der Karte', async ({ page, mock }) => {
  for (const name of ['BPC-157', 'TB-500', 'Ipamorelin', 'GHK-Cu']) seedPeptide(mock, name, { startDate: '2026-08-12' })
  bewertung(mock, 'BPC-157', { rating: 2, created_at: '2026-09-20T10:00:00.000Z' })
  bewertung(mock, 'TB-500', { rating: 5, created_at: '2026-09-01T10:00:00.000Z' })
  bewertung(mock, 'Ipamorelin', { rating: 3, created_at: '2026-09-10T10:00:00.000Z' })
  bewertung(mock, 'GHK-Cu', { rating: 4, created_at: '2026-09-05T10:00:00.000Z' })
  await page.goto('/bewertungen')

  const gruppen = page.locator('section[data-review-group] h2')
  await expect(gruppen).toHaveText(['BPC-157', 'Ipamorelin', 'GHK-Cu', 'TB-500'])
  await expect(page.locator('[data-review-date]').first()).toHaveText('geschrieben am 20.09.2026')

  await page.getByRole('button', { name: 'Reihenfolge: Neueste zuerst' }).click()
  const menue = page.getByRole('menu', { name: 'Reihenfolge' })
  await expect(menue.getByRole('menuitemradio', { name: 'Neueste zuerst' })).toHaveAttribute('aria-checked', 'true')
  await menue.getByRole('menuitemradio', { name: 'Meiste Sterne zuerst' }).click()
  await expect(menue).toHaveCount(0)
  await expect(gruppen).toHaveText(['TB-500', 'GHK-Cu', 'Ipamorelin', 'BPC-157'])
  await expect(page.getByRole('button', { name: 'Reihenfolge: Meiste Sterne zuerst' })).toContainText('Sterne')
})
