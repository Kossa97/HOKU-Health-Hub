import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Titel (Profil-Zusatz, Task 3 und 4): Chip unter dem Namen mit dem nächsten
 * Rang-Schritt, Sheet „Dein Titel“ (Wahl, Leiter steigt mit, Rang tragen),
 * persönliche Titel nur mit Schalter und Bestätigung (aus = Widerruf),
 * Einstieg über die Einstellungen und die Abzeichen-Seite, Sichtbarkeit für
 * andere angemeldete Nutzer nur auf „Alle“.
 *
 * Heute ist der 28.09.2026 (fixtures.ts).
 */

const MAX_ID = '00000000-0000-4000-8000-0000000000f7'

const profil = (mock: MockSupabase, id = TEST_USER.id) => mock.table('profiles').find(row => row.id === id)!

/** Eva mit Einträgen an `tage` Tagen (Tagebuch) und gespeicherten Abzeichen. */
function eva(mock: MockSupabase, { tage = 12, verdient = {} as Record<string, string> } = {}) {
  Object.assign(profil(mock), { username: 'e2e', display_name: 'Eva', field_visibility: {} })
  mock.insert('progress_settings', {
    user_id: TEST_USER.id, start_on: '2026-09-01', previous_starts: [], directions: {}, baselines: {}, history: [],
    earned_badges: verdient,
  })
  for (let n = 0; n < tage; n++) {
    const d = new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10)
    mock.insert('daily_logs', { user_id: TEST_USER.id, log_date: d, body_fat_pct: null, muscle_mass_kg: null })
  }
}

test('Eigenes Profil: Rang als Chip, nächster Schritt, Stufen-Chip „Nur ich“ schaltet weiter', async ({ page, mock }) => {
  eva(mock)
  await page.goto('/profil')
  const chip = page.locator('[data-profile-title] [data-title-chip]')
  await expect(chip).toHaveText('Entdecker')
  await expect(chip).toHaveCSS('text-transform', 'uppercase')
  await expect(page.locator('[data-rank-hint]')).toHaveText('Rang: noch 38 Tage mit Eintrag bis Dranbleiber')

  const vis = page.locator('[data-vis-chip="title"]')
  await expect(vis).toHaveText('Nur ich')
  await vis.click()
  await expect(vis).toHaveText('Freunde')
  await expect.poll(() => (profil(mock).field_visibility as Record<string, string>).title).toBe('friends')
})

test('Sheet „Dein Titel“: Abzeichen wählen ändert den Chip, die Leiter steigt mit, Rang tragen', async ({ page, mock }) => {
  eva(mock, { verdient: { run_10: '2026-09-05', streak_100: '2026-09-10' } })
  await page.goto('/profil')
  await page.locator('[data-profile-title] [data-title-chip]').click()
  const sheet = page.locator('[data-title-sheet]')
  await expect(sheet.locator('[data-title-worn]')).toHaveAttribute('data-title-worn', 'rank_2')
  await expect(sheet.locator('[data-rank-step="rank_2"]')).toHaveAttribute('data-rank-stage', 'cur')
  await expect(sheet.locator('[data-rank-progress]')).toContainText('noch 38 Tage mit Eintrag bis Dranbleiber')
  await expect(sheet.locator('[data-title-open]')).toHaveCount(5)

  await sheet.locator('[data-title-option="run_10"]').click()
  await expect(sheet.locator('[data-title-option="run_10"]')).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => profil(mock).title_choice).toBe('run_10')
  await sheet.locator('[data-title-sheet-done]').click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('[data-profile-title] [data-title-chip]')).toHaveText('Jogger')

  // Stufe 2 verdient: derselbe Titel steigt von selbst mit
  ;(mock.table('progress_settings')[0].earned_badges as Record<string, string>).run_50 = '2026-09-20'
  await page.reload()
  await expect(page.locator('[data-profile-title] [data-title-chip]')).toHaveText('Läufer')
  expect(profil(mock).title_choice).toBe('run_10')

  await page.locator('[data-profile-title] [data-title-chip]').click()
  await expect(sheet.locator('[data-title-option="run_10"]')).toHaveAttribute('data-title-shown', 'run_50')
  await sheet.locator('[data-title-option="rank"]').click()
  await expect.poll(() => profil(mock).title_choice).toBeNull()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-profile-title] [data-title-chip]')).toHaveText('Entdecker')
})

test('Persönlicher Titel: nur mit Schalter und Bestätigung; aus nimmt die Bestätigung zurück', async ({ page, mock }) => {
  eva(mock, { verdient: { body_fat_5: '2026-09-12' } })
  await page.goto('/profil')
  await page.locator('[data-profile-title] [data-title-chip]').click()
  const sheet = page.locator('[data-title-sheet]')
  const schalter = sheet.locator('[data-title-personal-switch]')
  await expect(schalter).toHaveAttribute('aria-checked', 'false')
  await expect(sheet.locator('[data-title-personal="body_fat_5"]')).toHaveCount(0)

  await schalter.click()
  await expect.poll(() => profil(mock).personal_titles).toBe(true)
  const zeile = sheet.locator('[data-title-personal="body_fat_5"]')
  await expect(zeile).toContainText('höchstens Nur ich, wie dein Feld Körperfett')

  // Abbrechen: nichts getragen, nichts bestätigt
  await zeile.click()
  const dialog = page.locator('[data-title-consent="body_fat_5"]')
  await expect(dialog).toContainText('Das ist ein Gesundheitsdatum.')
  await dialog.locator('[data-title-consent-cancel]').click()
  await expect(dialog).toHaveCount(0)
  await expect(sheet).toBeVisible()
  expect(profil(mock).title_choice ?? null).toBeNull()

  await zeile.click()
  await dialog.locator('[data-title-consent-ok]').click()
  await expect.poll(() => profil(mock).title_consents).toEqual({ body_fat_5: '2026-09-28' })
  expect(profil(mock).title_choice).toBe('body_fat_5')
  await expect(sheet.locator('[data-title-worn]')).toHaveAttribute('data-title-worn', 'body_fat_5')

  // Aus: Widerruf, zurück zum Rang
  await schalter.click()
  await expect.poll(() => profil(mock).title_consents).toEqual({})
  expect(profil(mock).title_choice).toBeNull()
  expect(profil(mock).personal_titles).toBe(false)
  await expect(sheet.locator('[data-title-worn]')).toHaveAttribute('data-title-worn', 'rank_2')

  // Wieder an: erneut bestätigen
  await schalter.click()
  await zeile.click()
  await expect(dialog).toBeVisible()
  await dialog.locator('[data-title-consent-cancel]').click()
  await page.locator('[data-title-sheet-done]').click()
  await expect(page.locator('[data-profile-title] [data-title-chip]')).toHaveText('Entdecker')
})

test('Einstellungen › Titel zeigt den getragenen Titel und öffnet dasselbe Sheet', async ({ page, mock }) => {
  eva(mock, { verdient: { streak_100: '2026-09-10' } })
  Object.assign(profil(mock), { title_choice: 'streak_100' })
  await page.goto('/profil/einstellungen')
  const zeile = page.locator('[data-setting-title]')
  await expect(zeile.locator('[data-setting-title-name]')).toHaveText('Unaufhaltsam')
  await zeile.click()
  const sheet = page.locator('[data-title-sheet]')
  await expect(sheet.locator('[data-title-option="streak_100"]')).toHaveAttribute('aria-checked', 'true')
  await sheet.locator('[data-title-option="rank"]').click()
  await expect.poll(() => profil(mock).title_choice).toBeNull()
  await sheet.locator('[data-title-sheet-done]').click()
  await expect(zeile.locator('[data-setting-title-name]')).toHaveText('Entdecker')
})

test('Abzeichen-Seite: Sportarten-Gruppe, Titelname am Abzeichen, „Als Titel tragen“', async ({ page, mock }) => {
  eva(mock, { verdient: { run_10: '2026-09-05' } })
  await page.goto('/profil/abzeichen')
  await expect(page.locator('[data-badge-group="sport"] h2')).toHaveText('Sportarten')
  await expect(page.locator('[data-badge-group="rang"]')).toHaveCount(0)
  const kachel = page.locator('[data-badge="run_10"]')
  await expect(kachel.locator('[data-badge-title]')).toHaveText('Jogger')
  // nicht verdient: Titelname ja, antippen nein
  await expect(page.locator('div[data-badge="run_50"] [data-badge-title]')).toHaveText('Läufer')

  await kachel.click()
  const sheet = page.locator('[data-badge-title-sheet="run_10"]')
  await sheet.locator('[data-badge-title-wear]').click()
  await expect.poll(() => profil(mock).title_choice).toBe('run_10')
  await expect(sheet.locator('[data-badge-title-wear]')).toHaveText('Trägst du gerade')
  await expect(sheet.locator('[data-badge-title-wear]')).toBeDisabled()
})

test('Fremdes Profil: Titel nur bei Feld auf „Alle“, Antippen erklärt ihn', async ({ page, mock }) => {
  const max = mock.insert('profiles', {
    id: MAX_ID, username: 'max', display_name: 'Max Muster', field_visibility: {},
    profile_private: false, web_link_enabled: true, title_choice: null, personal_titles: false, title_consents: {},
  })
  mock.insert('progress_settings', {
    user_id: MAX_ID, start_on: null, previous_starts: [], directions: {}, baselines: {}, history: [],
    earned_badges: { rank_1: '2026-05-01', rank_2: '2026-05-20', rank_3: '2026-08-01' },
  })
  await page.goto('/u/max')
  await expect(page.locator('[data-profile-name]')).toContainText('Max Muster')
  await expect(page.locator('[data-profile-title]')).toHaveCount(0)

  max.field_visibility = { title: 'friends' }
  await page.reload()
  await expect(page.locator('[data-profile-name]')).toContainText('Max Muster')
  await expect(page.locator('[data-profile-title]')).toHaveCount(0)

  max.field_visibility = { title: 'all' }
  await page.reload()
  const chip = page.locator('[data-profile-title] [data-title-chip]')
  await expect(chip).toHaveText('Dranbleiber')
  await expect(page.locator('[data-rank-hint]')).toHaveCount(0)
  await chip.click()
  await expect(page.locator('[data-title-meaning]')).toHaveText('Dranbleiber · Rang ab 50 Tagen mit eigenem Eintrag. Einmal erreicht, für immer.')
})
