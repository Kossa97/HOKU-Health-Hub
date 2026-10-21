import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'
import { TERMS_VERSION } from '../src/features/compliance/lib/consent'

/**
 * Store-Richtlinien: Zustimmung (18+, Bedingungen, Gesundheitsdaten),
 * Melden und Blockieren fremder Profile, Moderation, Textfilter fuer
 * oeffentliche Erfahrungen, Konto loeschen, Rechtsseiten.
 */

const FREMD_ID = '00000000-0000-4000-8000-0000000000f1'

/** Ein fremdes, oeffentliches Profil mit einer freigegebenen Erfahrung. */
function fremdesProfil(mock: MockSupabase) {
  mock.insert('profiles', { id: FREMD_ID, username: 'max', display_name: 'Max', is_public: true })
  const item = mock.insert('stack_items', { user_id: FREMD_ID, display_name: 'TB-500', category: 'peptide', archived: false })
  return mock.insert('reviews', {
    user_id: FREMD_ID, stack_item_id: item.id, cycle_id: null, rating: 3, title: 'Geteilt von Max', body: 'Lief gut.',
    pros: null, cons: null, experience: 'gut', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null,
    is_public: true, created_at: '2026-09-02T10:00:00.000Z', updated_at: null,
  })
}

test('Ohne Zustimmung kommt erst die Zustimmungsseite; alle drei Häkchen nötig', async ({ page, mock }) => {
  Object.assign(mock.table('profiles')[0], { age_confirmed_at: null, terms_accepted_at: null, terms_version: null })
  await page.goto('/')

  const gate = page.locator('[data-consent-gate]')
  await expect(gate).toBeVisible()
  await expect(gate.locator('[data-medical-notice]')).toContainText('kein Medizinprodukt')

  // Rechtstext im Sheet, das Formular bleibt.
  await gate.locator('[data-consent="alter"]').check()
  await gate.getByRole('button', { name: 'Nutzungsbedingungen' }).click()
  const sheet = page.locator('[data-legal-sheet]')
  await expect(sheet.getByRole('heading', { name: 'Nutzungsbedingungen' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(gate.locator('[data-consent="alter"]')).toBeChecked()

  await gate.locator('[data-consent="bedingungen"]').check()
  await gate.locator('[data-consent-submit]').click()
  await expect(gate).toBeVisible()
  expect(mock.table('profiles')[0].terms_version).toBeNull()

  await gate.locator('[data-consent="gesundheit"]').check()
  await gate.locator('[data-consent-submit]').click()
  await expect(gate).toBeHidden()
  expect(mock.table('profiles')[0]).toMatchObject({ terms_version: TERMS_VERSION })
  expect(mock.table('profiles')[0].age_confirmed_at).toBeTruthy()
  expect(mock.table('profiles')[0].terms_accepted_at).toBeTruthy()
})

test('Fremdes Profil: Erfahrung melden, Profil blockieren, im eigenen Profil wieder freigeben', async ({ page, mock }) => {
  const review = fremdesProfil(mock)
  await page.goto('/u/max')
  await expect(page.locator('[data-public-review]')).toContainText('Geteilt von Max')

  await page.locator('[data-report-open]').click()
  const report = page.locator('[data-report-sheet]')
  await expect(report.locator('[data-report-send]')).toBeDisabled()
  await report.locator('[data-report-reason="werbung"]').check()
  await report.locator('[data-report-details]').fill('Nennt einen Shop.')
  await report.locator('[data-report-send]').click()
  await expect(report).toBeHidden()
  await expect(page.getByText('Danke — die Meldung ist eingegangen.')).toBeVisible()
  expect(mock.table('content_reports')).toEqual([
    expect.objectContaining({ review_id: review.id, reporter_id: TEST_USER.id, reason: 'werbung', details: 'Nennt einen Shop.', status: 'offen' }),
  ])

  // Auch das ganze Profil (Name, Bio) laesst sich melden.
  await page.locator('[data-report-profile]').click()
  await expect(page.getByRole('heading', { name: 'Profil melden' })).toBeVisible()
  await page.locator('[data-report-reason="beleidigung"]').check()
  await page.locator('[data-report-send]').click()
  await expect(page.locator('[data-report-sheet]')).toBeHidden()
  expect(mock.table('content_reports').filter(row => row.review_id === null)).toHaveLength(1)

  await page.locator('[data-block-open]').click()
  await page.locator('[data-block-confirm]').click()
  await expect(page.locator('[data-profile-blocked]')).toBeVisible()
  await expect(page.getByText('Geteilt von Max')).toHaveCount(0)

  await page.goto('/profil')
  const liste = page.locator('[data-blocked-list]')
  await expect(liste).toContainText('@max')
  await liste.locator('[data-unblock="max"]').click()
  await expect(page.getByText('Du hast niemanden blockiert.')).toBeVisible()
  expect(mock.table('user_blocks')).toHaveLength(0)
})

test('Eigenes öffentliches Profil: weder Melden noch Blockieren', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  Object.assign(mock.table('profiles')[0], { username: 'anna', is_public: true })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  mock.insert('reviews', {
    user_id: TEST_USER.id, stack_item_id: item.id, cycle_id: null, rating: 4, title: 'Meins', body: null, pros: null, cons: null,
    experience: 'gut', wirkung: null, vertraeglichkeit: null, wieder_nehmen: null, is_public: true,
    created_at: '2026-09-01T10:00:00.000Z', updated_at: null,
  })
  await page.goto('/u/anna')
  await expect(page.locator('[data-public-review]')).toContainText('Meins')
  await expect(page.locator('[data-report-open]')).toHaveCount(0)
  await expect(page.locator('[data-report-profile]')).toHaveCount(0)
  await expect(page.locator('[data-block-open]')).toHaveCount(0)
})

test('Öffentliche Erfahrung mit Link: Filter sagt warum, das Sheet bleibt offen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-12' })
  await page.goto('/bewertungen')
  await page.getByRole('button', { name: 'Neu', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Neue Erfahrung' })
  await sheet.getByRole('combobox', { name: 'Substanz' }).selectOption({ label: 'BPC-157' })
  await sheet.getByRole('radio', { name: '4 Sterne' }).click()
  await sheet.getByLabel('Notiz', { exact: true }).fill('Mehr unter https://example.test')
  await sheet.locator('[data-review-public]').check()
  await expect(sheet.locator('[data-review-public-rules]')).toBeVisible()
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Öffentliche Erfahrungen dürfen keine Links')).toBeVisible()
  await expect(sheet).toBeVisible()
  expect(mock.table('reviews')).toHaveLength(0)
})

test('Admin: Meldung sehen und Erfahrung ausblenden', async ({ page, mock }) => {
  mock.table('profiles')[0].is_admin = true
  const review = fremdesProfil(mock)
  mock.insert('content_reports', {
    review_id: review.id, reported_user_id: FREMD_ID, reporter_id: null, reason: 'gefaehrlich', details: 'Dosis für andere', status: 'offen',
    snapshot: { art: 'erfahrung', username: 'max', substanz: 'TB-500', title: 'Geteilt von Max', body: 'Lief gut.' },
  })

  await page.goto('/lab/admin')
  const meldung = page.locator('[data-moderation-report]')
  await expect(meldung).toContainText('Geteilt von Max')
  await expect(meldung).toContainText('@max')
  await meldung.locator('[data-moderation-hide]').click()
  await expect(page.getByText('Keine offenen Meldungen.')).toBeVisible()
  expect(mock.table('reviews').find(row => row.id === review.id)?.hidden_by_moderation).toBe(true)

  await page.goto('/u/max')
  await expect(page.locator('[data-public-review]')).toHaveCount(0)
})

test('Admin: gemeldetes Profil ausblenden — danach ist es nicht mehr erreichbar', async ({ page, mock }) => {
  mock.table('profiles')[0].is_admin = true
  fremdesProfil(mock)
  Object.assign(mock.table('profiles').find(row => row.id === FREMD_ID)!, { public_bio: 'Schreib mir privat' })
  mock.insert('content_reports', {
    review_id: null, reported_user_id: FREMD_ID, reporter_id: null, reason: 'werbung', details: null, status: 'offen',
    snapshot: { art: 'profil', username: 'max', display_name: 'Max', public_bio: 'Schreib mir privat' },
  })
  await page.goto('/lab/admin')
  const meldung = page.locator('[data-moderation-report]')
  await expect(meldung).toContainText('Profil (Name und Bio)')
  await expect(meldung).toContainText('Schreib mir privat')
  await meldung.locator('[data-moderation-hide]').click()
  await expect(page.getByText('Keine offenen Meldungen.')).toBeVisible()

  await page.goto('/u/max')
  await expect(page.getByText('Profil nicht verfügbar')).toBeVisible()
})

test('Konto löschen: erst das Wort, dann Dateien, Konto und Abmeldung', async ({ page, mock }) => {
  mock.storage.set('progress-photos', [`${TEST_USER.id}/1.jpg`, `${TEST_USER.id}/2.jpg`, 'jemand-anders/3.jpg'])
  mock.storage.set('batch-files', [`${TEST_USER.id}/analyse.pdf`, `progress/${TEST_USER.id}/alt.jpg`, 'progress/jemand-anders/x.jpg'])
  await page.goto('/profil')

  await page.locator('[data-account-delete-open]').click()
  const sheet = page.locator('[data-account-delete-sheet]')
  const loeschen = sheet.locator('[data-account-delete-confirm]')
  await expect(loeschen).toBeDisabled()
  await sheet.locator('[data-account-delete-input]').fill('löschen')
  await expect(loeschen).toBeEnabled()
  await loeschen.click()

  await expect(page).toHaveURL(/\/auth$/)
  expect(mock.storage.get('progress-photos')).toEqual(['jemand-anders/3.jpg'])
  expect(mock.storage.get('batch-files')).toEqual(['progress/jemand-anders/x.jpg'])
  expect(mock.log).toContain('ACCOUNT DELETED')
  expect(mock.table('profiles').some(row => row.id === TEST_USER.id)).toBe(false)
})

test('Rechtsseiten sind erreichbar und zeigen offene Platzhalter als Entwurf', async ({ page }) => {
  await page.goto('/datenschutz')
  await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible()
  await expect(page.locator('[data-legal-draft]')).toBeVisible()
  await expect(page.locator('[data-legal-placeholder]').first()).toBeVisible()
  await page.locator('[data-legal-links]').getByRole('link', { name: 'Impressum' }).click()
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible()
})
