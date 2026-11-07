import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/** Profil 2a: Schaufenster mit Stufen-Chips, Einstellungen hinter ⚙︎. */

function eigenesProfil(mock: MockSupabase) {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  Object.assign(profil, {
    username: 'mara.lifts', display_name: 'Mara K.', public_bio: 'Recomp seit März. Viel Grundübungen, Blutbild alle 3 Monate.',
    goals: ['recomp', 'kraft', 'longevity', 'blutwerte', 'schlaf'], country: 'DE', profile_gender: 'female',
    created_at: '2026-03-02T10:00:00.000Z',
    field_visibility: { bio: 'all', goals: 'all', streak: 'all', member_since: 'all', country: 'all', gender: 'friends', age: 'friends', weight: 'friends', workouts: 'all' },
  })
  mock.insert('profile_snapshots', {
    user_id: TEST_USER.id,
    data: {
      age: { v: 29 }, height: { v: 172, unit: 'cm' }, weight: { v: 81, unit: 'kg', delta: -3.2 },
      body_fat: { v: 15.8, unit: '%', delta: -3.6 }, muscle_mass: { v: 38.9, unit: 'kg', delta: 1.4 },
      measurements: { unit: 'cm', sites: [{ site: 'waist', v: 84, delta: -5 }, { site: 'upper_arm', v: 37.5, delta: 1 }, { site: 'chest', v: 98 }] },
      adherence: { pct: 94, confirmed: 212, missed: 13, days: 90 }, substances: { count: 6, activeCycles: 2 },
      markers: { count: 24 }, in_range: { inRange: 19, of: 24 },
      steps: { v: 9840, unit: 'steps', delta: 3700 }, resting_hr: { v: 54, unit: 'bpm', delta: -7 }, sleep: { v: 432, unit: 'min', delta: 52 },
      workouts: { total: 86, perWeek: 3.6 }, routine: { name: 'Upper / Lower' },
      favorite_exercise: { id: 'deadlift_barbell', name: 'Kreuzheben' },
      e1rm: { unit: 'kg', top: [{ id: 'a', name: 'Kreuzheben', v: 142 }, { id: 'b', name: 'Kniebeuge', v: 118 }, { id: 'c', name: 'Bankdrücken', v: 97 }] },
      reviews: { count: 12, avgRating: 4.3 }, streak: { days: 41 },
    },
  })
  return profil
}

test('Profil: Schaufenster mit Stufen; Chip schaltet und speichert', async ({ page, mock }) => {
  const profil = eigenesProfil(mock)
  await page.goto('/profil')

  const kopf = page.locator('[data-profile-head]')
  await expect(kopf.locator('[data-profile-name]')).toContainText('Mara K.')
  await expect(kopf.locator('[data-profile-country]')).toHaveText('🇩🇪 DE')
  await expect(kopf.locator('[data-profile-nick]')).toHaveText('@mara.lifts')
  await expect(kopf.locator('[data-profile-meta]')).toContainText('41 Tage Streak')
  await expect(kopf.locator('[data-profile-meta]')).toContainText('Mitglied seit März 2026')
  await expect(page.locator('[data-profile-card="ueber"] [data-tile-layout]')).toHaveAttribute('data-tile-layout', 'r3')

  // Chip in derselben Zeile wie die Beschriftung, auch in der schmalen Dreier-Kachel
  const alter = page.locator('[data-profile-tile="age"]')
  const chip = alter.locator('[data-vis-chip="age"]')
  await expect(chip).toHaveText('Freunde')
  const [label, chipBox] = await Promise.all([alter.locator('div').first().boundingBox(), chip.boundingBox()])
  expect(chipBox!.height).toBeLessThan(label!.height + 1)

  await page.screenshot({ path: 'test-results/profil-2a-profil.png', fullPage: true })

  await chip.click()
  await expect(chip).toHaveText('Alle')
  await expect.poll(() => (profil.field_visibility as Record<string, string>).age).toBe('all')
  await chip.click()
  await expect(chip).toHaveText('Nur ich')
  await expect.poll(() => (profil.field_visibility as Record<string, string>).age).toBeUndefined()
})

test('Einstellungen: privat, Web-Link, Wer sieht was, Blockiert', async ({ page, mock }) => {
  const profil = eigenesProfil(mock)
  await page.goto('/profil')
  await page.locator('[data-profile-settings]').click()
  await expect(page).toHaveURL(/\/profil\/einstellungen$/)
  await expect(page.locator('[data-look-switcher]')).toBeVisible()
  await page.screenshot({ path: 'test-results/profil-2a-einstellungen.png', fullPage: true })

  await page.locator('[data-setting-private]').click()
  await expect.poll(() => profil.profile_private).toBe(true)
  await page.locator('[data-setting-weblink]').click()
  await expect.poll(() => profil.web_link_enabled).toBe(true)

  await page.locator('[data-setting-wer]').click()
  await expect(page).toHaveURL(/\/profil\/sichtbarkeit$/)
  await expect(page.locator('[data-wer-feld]')).toHaveCount(32)
  await expect(page.locator('[data-wer-privat]')).toBeVisible()
  await page.locator('[data-settings-back]').click()
  await page.locator('[data-setting-private]').click()
  await expect.poll(() => profil.profile_private).toBe(false)

  await page.locator('[data-setting-wer]').click()
  await page.locator('[data-bereich-alle="koerper:all"]').click()
  await expect.poll(() => profil.field_visibility).toMatchObject({ body_fat: 'all', muscle_mass: 'all', measurements: 'all' })
  await page.screenshot({ path: 'test-results/profil-2a-sichtbarkeit.png', fullPage: true })

  await page.locator('[data-settings-back]').click()
  await page.locator('[data-setting-blocked]').click()
  await expect(page).toHaveURL(/\/profil\/blockiert$/)
  await expect(page.getByText('Du hast niemanden blockiert.')).toBeVisible()
})

test('Bearbeiten: Bio speichern, Lieblingsübung wählen', async ({ page, mock }) => {
  const profil = eigenesProfil(mock)
  await page.goto('/profil')
  await page.locator('[data-profile-edit]').click()
  const sheet = page.locator('[data-profile-edit-sheet]')
  await sheet.locator('#profil-bio').fill('Neue Bio')
  await sheet.locator('[data-profile-edit-save]').click()
  await expect.poll(() => profil.public_bio).toBe('Neue Bio')

  await sheet.locator('[data-favorite-open]').click()
  await page.getByPlaceholder('Übung suchen').first().fill('Kniebeuge')
  await page.getByRole('button', { name: /Kniebeuge/ }).first().click()
  await expect.poll(() => profil.favorite_exercise).toBeTruthy()
  await expect(sheet.locator('[data-favorite-open]')).toContainText('Kniebeuge')
})
