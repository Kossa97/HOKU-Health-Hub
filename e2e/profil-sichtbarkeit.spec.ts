import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Sichtbarkeit von Anfang bis Ende (Profil 2a): Chip im eigenen Profil
 * umschalten → „Ansehen als App-Nutzer“ zeigt den Wert; zurück auf „Nur ich“ →
 * Wert und Karte sind für andere weg, ohne Lücke. Dazu der Abschnitt in der
 * Datenschutzerklärung, erreichbar aus den Einstellungen.
 */

/**
 * Eva: Alter (Über mich) startet auf „Nur ich“, Körperfett (Körper) auf „Alle“.
 * Die Quelldaten (Geburtsdatum, Tageseintrag) passen zum Schnappschuss: Das
 * Öffnen von /profil stößt nach 2 s einen neuen Schnappschuss an, der den
 * vorgegebenen ersetzt. In WebKit war „Ansehen als“ oft erst danach dran, und
 * ohne Geburtsdatum fehlte dann das Alter.
 */
function eva(mock: MockSupabase, heute: Date) {
  const profil = mock.table('profiles').find(row => row.id === TEST_USER.id)!
  const geboren = new Date(Date.UTC(heute.getUTCFullYear() - 30, heute.getUTCMonth(), 1) + 45 * 864e5).toISOString().slice(0, 10)
  Object.assign(profil, { username: 'e2e', display_name: 'Eva', birth_date: geboren, field_visibility: { body_fat: 'all' } })
  mock.insert('daily_logs', { user_id: TEST_USER.id, log_date: heute.toISOString().slice(0, 10), body_fat_pct: 15.8 })
  mock.insert('profile_snapshots', { user_id: TEST_USER.id, data: { age: { v: 29 }, body_fat: { v: 15.8, unit: '%' } } })
  return profil
}

async function ansehenAlsAppNutzer(page: import('@playwright/test').Page) {
  await page.goto('/profil')
  await page.locator('[data-profile-settings]').click()
  await page.locator('[data-setting-ansehen]').click()
  await page.locator('[data-ansehen-als="all"]').click()
  await expect(page).toHaveURL(/\/u\/e2e\?als=all$/)
  await expect(page.locator('[data-view-as="all"]')).toBeVisible()
}

test('Chip auf „Alle“ → „Ansehen als“ zeigt den Wert; zurück auf „Nur ich“ → Wert und Karte weg, keine Lücke', async ({ page, mock, now }) => {
  const profil = eva(mock, now)
  await page.goto('/profil')

  // Nur ich → Freunde → Alle
  const chip = page.locator('[data-vis-chip="age"]')
  await expect(chip).toHaveText('Nur ich')
  await chip.click()
  await expect(chip).toHaveText('Freunde')
  await chip.click()
  await expect(chip).toHaveText('Alle')
  await expect.poll(() => (profil.field_visibility as Record<string, string>).age).toBe('all')

  // Andere sehen Alter und Körperfett: zwei Ein-Wert-Karten in einer Reihe
  await ansehenAlsAppNutzer(page)
  await expect(page.locator('[data-profile-tile="age"]')).toContainText('29')
  await expect(page.locator('[data-profile-tile="body_fat"]')).toContainText('15,8')
  const paar = page.locator('[data-profile-pair]')
  await expect(paar).toHaveCount(1)
  await expect(paar.locator('[data-profile-card="ueber"]')).toBeVisible()
  await expect(paar.locator('[data-profile-card="koerper"]')).toBeVisible()

  // Zurück auf „Nur ich“ (Alle → Nur ich)
  await page.goto('/profil')
  await chip.click()
  await expect(chip).toHaveText('Nur ich')
  await expect.poll(() => (profil.field_visibility as Record<string, string>).age).toBeUndefined()
  // Im eigenen Profil bleibt der Wert sichtbar
  await expect(page.locator('[data-profile-tile="age"]')).toContainText('29')

  // Andere: Alter und „Über mich“ weg; Körper allein über die volle Breite
  await ansehenAlsAppNutzer(page)
  await expect(page.locator('[data-profile-tile="body_fat"]')).toContainText('15,8')
  await expect(page.locator('[data-profile-tile="age"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-card="ueber"]')).toHaveCount(0)
  await expect(page.locator('[data-profile-pair]')).toHaveCount(0)
  await expect(page.getByText('29', { exact: true })).toHaveCount(0)
  const [karten, koerper] = await Promise.all([
    page.locator('[data-profile-cards]').boundingBox(),
    page.locator('[data-profile-card="koerper"]').boundingBox(),
  ])
  expect(karten && koerper && Math.abs(karten.width - koerper.width)).toBeLessThan(1)
  await page.screenshot({ path: 'test-results/profil-2a-ansehen-als-alle.png', fullPage: true })
})

test('Datenschutz: Abschnitt „Profil und Sichtbarkeit“ aus den Einstellungen erreichbar', async ({ page }) => {
  await page.goto('/profil/einstellungen')
  await page.locator('[data-legal-links]').getByRole('link', { name: 'Datenschutz' }).click()
  await expect(page).toHaveURL(/\/datenschutz$/)
  const abschnitt = page.locator('#profil-sichtbarkeit')
  await expect(abschnitt.getByRole('heading', { name: '6. Profil und Sichtbarkeit' })).toBeVisible()
  await expect(abschnitt).toContainText('Standard ist für jedes Feld „Nur ich“')
  await expect(page.locator('section').filter({ hasText: 'Bild-Check für Profil- und Titelbild' })).toBeVisible()

  // Direkt über die Sprungmarke
  await page.goto('/datenschutz#profil-sichtbarkeit')
  await expect(abschnitt.getByRole('heading', { name: '6. Profil und Sichtbarkeit' })).toBeInViewport()
})
