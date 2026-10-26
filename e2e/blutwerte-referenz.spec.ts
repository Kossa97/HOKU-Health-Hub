import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { messungBearbeiten, messungenAufklappen } from './support/blutwerte'

/**
 * Referenzbereiche nach Geschlecht und Alter: ohne Angaben gilt der allgemeine
 * Bereich und die Seite bietet die Angaben an; danach gilt der Bereich der
 * Gruppe. Ein Laborbereich am Befund steht bei der Messung; bewertet wird nach
 * dem Bereich aus der Quelle, damit das Band ueber Labore hinweg gleich bleibt.
 */

function testosteron(mock: MockSupabase, felder: Record<string, unknown> = {}) {
  return mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker: 'Testosteron', value: 300, unit: 'ng/dL', notes: null,
    report_id: null, ref_min: null, ref_max: null, ...felder,
  })
}

const eigenesProfil = (mock: MockSupabase) => mock.table('profiles').find(row => row.id === TEST_USER.id)!

test('Hinweis öffnet die Angaben; danach gilt der Bereich für Männer', async ({ page, mock }) => {
  testosteron(mock)
  await page.goto('/blutwerte')

  // Allgemein 400–900: 300 ist auffällig.
  await expect(page.getByRole('button', { name: 'Auffällige (1)' })).toBeVisible()
  const hinweis = page.locator('[data-bio-hint]')
  await expect(hinweis).toContainText('Passendere Referenzbereiche')
  await hinweis.getByRole('button', { name: 'Alter und Geschlecht angeben' }).click()

  const sheet = page.locator('[data-bio-sheet]')
  await expect(sheet.getByRole('heading', { name: 'Alter und Geschlecht' })).toBeVisible()
  await sheet.getByLabel('Geburtsdatum').fill('1980-03-15')
  await sheet.getByRole('radio', { name: 'Männlich' }).click()
  await expect(sheet.getByRole('radio', { name: 'Männlich' })).toHaveAttribute('aria-checked', 'true')
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  await expect(sheet).toHaveCount(0)
  await expect.poll(() => [eigenesProfil(mock).birth_date, eigenesProfil(mock).bio_sex]).toEqual(['1980-03-15', 'male'])
  await expect(hinweis).toHaveCount(0)
  // Männer 271–1070: 300 liegt im Bereich.
  await expect(page.getByRole('button', { name: 'Auffällige', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Testosteron/ }).first().click()
  await expect(page.locator('[data-bw-status]')).toHaveText('Im Normalbereich')
  await expect(page.locator('[data-bw-hero] [data-bw-range-source]').first()).toHaveText('(Männer)')
})

test('Quelle geht vor, der Laborbereich steht bei der Messung; ausgeblendeter Hinweis bleibt weg', async ({ page, mock }) => {
  // 300 liegt unter dem Laborbereich 350–1000, aber im Bereich fuer Maenner (271–1070)
  testosteron(mock, { ref_min: 350, ref_max: 1000 })
  const profil = eigenesProfil(mock)
  profil.birth_date = '1980-03-15'
  profil.bio_sex = 'male'
  await page.goto('/blutwerte')

  await expect(page.locator('[data-bio-hint]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Testosteron/ }).first().click()
  await expect(page.locator('[data-bw-hero] [data-bw-range-source]').first()).toHaveText('(Männer)')
  await expect(page.locator('[data-bw-status]')).toHaveText('Im Normalbereich')
  await messungenAufklappen(page)
  await expect(page.locator('[data-bw-entry]').first()).toContainText('Labor 350–1.000 ng/dL')
})

test('Hinweis lässt sich ausblenden', async ({ page, mock }) => {
  testosteron(mock)
  await page.goto('/blutwerte')
  await page.locator('[data-bio-hint-dismiss]').click()
  await expect(page.locator('[data-bio-hint]')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Auffällige (1)' })).toBeVisible()
  await expect(page.locator('[data-bio-hint]')).toHaveCount(0)
})

test('Östradiol bei Frauen: kein Standardbereich, kein falsches Urteil', async ({ page, mock }) => {
  mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker: 'Östradiol', value: 150, unit: 'pg/mL', notes: null,
    report_id: null, ref_min: null, ref_max: null,
  })
  const profil = eigenesProfil(mock)
  profil.birth_date = '1990-05-01'
  profil.bio_sex = 'female'
  await page.goto('/blutwerte')
  await expect(page.getByRole('button', { name: 'Auffällige', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Östradiol/ }).first().click()
  await expect(page.locator('[data-bw-no-range]')).toContainText('Für Frauen hängt der Bereich hier von Zyklus und Wechseljahren ab')
  await expect(page.locator('[data-bw-status]')).toHaveText('Kein Referenzbereich')
})

test('Profil: Angaben ändern und speichern', async ({ page, mock }) => {
  await page.goto('/profil')
  const karte = page.locator('[data-bio-profile-card]')
  await expect(karte.getByRole('heading', { name: 'Alter und Geschlecht' })).toBeVisible()
  const speichern = karte.getByRole('button', { name: 'Speichern' })
  await expect(speichern).toBeDisabled()
  await karte.getByLabel('Geburtsdatum').fill('1975-11-02')
  await karte.getByRole('radio', { name: 'Weiblich' }).click()
  await speichern.click()
  await expect.poll(() => [eigenesProfil(mock).birth_date, eigenesProfil(mock).bio_sex]).toEqual(['1975-11-02', 'female'])
  await expect(speichern).toBeDisabled()

  // Zurück auf „Keine Angabe“ speichert NULL.
  await karte.getByRole('radio', { name: 'Keine Angabe' }).click()
  await speichern.click()
  await expect.poll(() => eigenesProfil(mock).bio_sex).toBeNull()
})

test('Frauen: Wechseljahre beim Bearbeiten angeben; danach gilt der passende Bereich', async ({ page, mock }) => {
  const wert = mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker: 'Östradiol', value: 150, unit: 'pg/mL', notes: null,
    report_id: null, ref_min: null, ref_max: null, menopause: null,
  })
  Object.assign(eigenesProfil(mock), { birth_date: '1970-05-01', bio_sex: 'female' })
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Östradiol/ }).first().click()
  await expect(page.locator('[data-bw-no-range]')).toContainText('Gib beim Wert an')

  await messungBearbeiten(page, '150 pg/mL vom 15.09.2026')
  const frage = page.locator('[data-bw-menopause]')
  await expect(frage.getByRole('radio', { name: 'Weiß nicht' })).toHaveAttribute('aria-checked', 'true')
  await frage.getByRole('radio', { name: 'Schon durch' }).click()
  await page.locator('[data-app-modal]').getByRole('button', { name: 'Speichern' }).click()

  await expect.poll(() => mock.table('bloodwork').find(r => r.id === wert.id)?.menopause).toBe('post')
  // Nach den Wechseljahren bis 30 pg/mL: 150 liegt 120 darüber
  await expect(page.locator('[data-bw-status]')).toHaveText('120 pg/mL über dem Bereich')
  await expect(page.locator('[data-bw-hero] [data-bw-range-source]').first()).toHaveText('(Frauen, nach den Wechseljahren)')
})

test('Männer werden nicht nach den Wechseljahren gefragt', async ({ page, mock }) => {
  mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker: 'Östradiol', value: 30, unit: 'pg/mL', notes: null,
    report_id: null, ref_min: null, ref_max: null,
  })
  Object.assign(eigenesProfil(mock), { birth_date: '1980-05-01', bio_sex: 'male' })
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Östradiol/ }).first().click()
  await messungBearbeiten(page, '30 pg/mL vom 15.09.2026')
  await expect(page.locator('[data-app-modal]')).toBeVisible()
  await expect(page.locator('[data-bw-menopause]')).toHaveCount(0)
})

test('Formular nennt den Bereich, der ohne Laborangabe wirklich gilt', async ({ page, mock }) => {
  mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker: 'Östradiol', value: 150, unit: 'pg/mL', notes: null,
    report_id: null, ref_min: null, ref_max: null,
  })
  Object.assign(eigenesProfil(mock), { birth_date: '1970-05-01', bio_sex: 'female' })
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Alle', exact: true }).click()
  await page.getByRole('button', { name: /Östradiol/ }).first().click()
  await messungBearbeiten(page, '150 pg/mL vom 15.09.2026')
  const modal = page.locator('[data-app-modal]')
  // Ohne Angabe zu den Wechseljahren gibt es keinen Standardbereich — also kein falscher Hinweis
  await expect(modal.getByText('Ohne eigenen Bereich gilt der Standardbereich')).toHaveCount(0)
  await modal.locator('[data-bw-menopause]').getByRole('radio', { name: 'Schon durch' }).click()
  await expect(modal.getByText('Ohne eigenen Bereich gilt der Standardbereich bis 30 pg/mL.')).toBeVisible()
})
