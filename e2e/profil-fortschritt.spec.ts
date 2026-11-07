import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { START, evaMitFortschritt } from './support/fortschrittDaten'

/**
 * Gesamtfortschritt und Abzeichen (Profil 2b): Karte im Profil, Zeitreise und
 * Aufschlüsselung unter /profil/fortschritt (Richtung ändern rechnet neu,
 * neuer Start, vorheriger Start wieder wählbar), Zeitreise per Tastatur,
 * fremdes Profil nur mit Gesamt und Bereichen, Seite „Alle Abzeichen“.
 *
 * Heute ist der 28.09.2026 (fixtures.ts), Start der 14.03.2026.
 */

const MAX_ID = '00000000-0000-4000-8000-0000000000f3'

const settings = (mock: MockSupabase) => mock.table('progress_settings').find(row => row.user_id === TEST_USER.id)!

test('Profilkarte: Leitzahl, fünf Bereiche um die Nulllinie, Bereich klappt Werte auf, Karte öffnet die Zeitreise', async ({ page, mock }) => {
  evaMitFortschritt(mock)
  await page.goto('/profil')
  const karte = page.locator('[data-progress-card]')
  await expect(karte.locator('[data-progress-total]')).toHaveText(/^\+\d+,\d %$/)
  await expect(karte.locator('[data-progress-since]')).toContainText('seit 14.03.2026 · Mittel aus 5 von 5 Bereichen')
  await expect(karte.locator('[data-progress-area]')).toHaveCount(5)
  await expect(karte.locator('[data-vis-chip="progress"]')).toHaveText('Nur ich')

  await karte.locator('[data-progress-area-toggle="koerper"]').click()
  await expect(karte.locator('[data-progress-value="body_fat"]')).toContainText('+18,6 %')
  await expect(karte.locator('[data-progress-value="body_fat"]')).toContainText('19,4 → 15,8 %')

  await karte.locator('[data-progress-total]').click()
  await expect(page).toHaveURL(/\/profil\/fortschritt$/)
  await expect(page.locator('[data-zeitreise]')).toBeVisible()
})

test('Richtung ändern rechnet sofort neu und wird gespeichert', async ({ page, mock }) => {
  evaMitFortschritt(mock)
  await page.goto('/profil/fortschritt')
  const gesamt = page.locator('[data-progress-detail-total]')
  await expect(gesamt).toHaveText(/^\+\d+,\d %$/)
  const vorher = await gesamt.textContent()
  const kfa = page.locator('[data-progress-metric="body_fat"]')
  await expect(kfa.locator('[data-progress-metric-change]')).toHaveText('+18,6 %')

  await kfa.getByRole('button', { name: '↑ hoch' }).click()
  await expect(kfa.locator('[data-progress-metric-change]')).toHaveText('−18,6 %')
  await expect(kfa.locator('[data-progress-metric-detail]')).toContainText('von dir gewählt')
  await expect(gesamt).not.toHaveText(vorher!)
  await expect.poll(() => settings(mock).directions).toEqual({ body_fat: 'up' })

  await kfa.getByRole('button', { name: 'aus' }).click()
  await expect(kfa.locator('[data-progress-metric-change]')).toHaveText('–')
  await expect.poll(() => settings(mock).directions).toEqual({ body_fat: 'off' })

  // Zurück auf die Standardrichtung: nichts mehr gespeichert
  await kfa.getByRole('button', { name: '↓ runter' }).click()
  await expect(gesamt).toHaveText(vorher!)
  await expect.poll(() => settings(mock).directions).toEqual({})

  // e1RM mit dem Übungsnamen in der App-Sprache, nie mit der Kennung
  const e1rm = page.locator('[data-progress-metric="e1rm:deadlift_barbell"]')
  await expect(e1rm).toContainText('Kreuzheben (Langhantel) e1RM')
  await expect(e1rm).not.toContainText('deadlift')

  // Anteilswerte: nur Zielbereich oder aus
  const blut = page.locator('[data-progress-direction="markers_in_range"]')
  await expect(blut.getByRole('button')).toHaveText(['Zielbereich', 'aus'])
})

test('Neuer Start mit Bestätigung; der alte Start bleibt wählbar', async ({ page, mock }) => {
  evaMitFortschritt(mock)
  await page.goto('/profil/fortschritt')
  await expect(page.locator('[data-progress-start-day]')).toHaveText('14.03.2026')

  await page.locator('[data-progress-new-start]').click()
  const sheet = page.locator('[data-progress-new-start-sheet]')
  await expect(sheet).toContainText('14.03.2026')
  await sheet.locator('[data-progress-new-start-ok]').click()
  await expect(sheet).toHaveCount(0)
  await expect(page.locator('[data-progress-start-day]')).toHaveText('28.09.2026')
  await expect.poll(() => settings(mock).start_on).toBe('2026-09-28')
  expect(settings(mock).previous_starts).toEqual([START])
  // Ab heute zählt noch kein Wert: kein Gesamt
  await expect(page.locator('[data-progress-detail-total]')).toHaveText('–')

  await page.locator(`[data-progress-restore="${START}"]`).click()
  await expect(page.locator('[data-progress-start-day]')).toHaveText('14.03.2026')
  await expect.poll(() => settings(mock).start_on).toBe(START)
  expect(settings(mock).previous_starts).toEqual(['2026-09-28'])
  await expect(page.locator('[data-progress-detail-total]')).toHaveText(/^\+\d+,\d %$/)
})

test('Zeitreise per Tastatur: Pos1, Pfeile, Ende; Abzeichen als Ringe', async ({ page, mock }) => {
  evaMitFortschritt(mock)
  await page.goto('/profil/fortschritt')
  const plot = page.locator('[data-zeitreise-plot]')
  const wann = page.locator('[data-zeitreise-wann]')
  await expect(wann).toHaveText('heute')
  const heute = await page.locator('[data-zeitreise-total]').textContent()

  await plot.focus()
  await page.keyboard.press('Home')
  await expect(wann).toHaveText('Woche vom 09.03.2026')
  await expect(plot).toHaveAttribute('aria-valuenow', '0')
  await page.keyboard.press('ArrowRight')
  await expect(wann).toHaveText('Woche vom 16.03.2026')
  await page.keyboard.press('End')
  await expect(wann).toHaveText('heute')
  await expect(page.locator('[data-zeitreise-total]')).toHaveText(heute!)
  await page.keyboard.press('ArrowLeft')
  await expect(wann).toHaveText('Woche vom 21.09.2026')

  await expect(page.locator('[data-zeitreise-badge="streak_7"]')).toHaveCount(1)
  await expect(page.locator('[data-zeitreise-badge="first_pr"]')).toHaveCount(1)
  await expect(plot).toHaveCSS('touch-action', 'none')
})

test('Fremdes Profil: Gesamt und Bereiche nur bei Freigabe, ohne Einzelwerte, Chips und Zeitreise', async ({ page, mock }) => {
  mock.insert('profiles', {
    id: MAX_ID, username: 'max', display_name: 'Max Muster', field_visibility: { progress: 'all', badges: 'all' },
    profile_private: false, web_link_enabled: false,
  })
  mock.insert('profile_snapshots', {
    user_id: MAX_ID,
    data: {
      // Was ein Gerät (auch ein manipuliertes) schreiben könnte: Einzelwerte und Verlauf fallen weg
      progress: { total: 28.35, areas: { koerper: 7.66, blut: 58.33, training: -4.2, geheim: 1 }, since: '2026-03-14',
        werte: { body_fat: 18.6 }, history: [{ week: '2026-03-16', total: 1 }] },
      badges: ['streak_7', 'hack', 'first_pr', 'streak_7'],
    },
  })
  await page.goto('/u/max')
  const karte = page.locator('[data-progress-card]')
  await expect(karte.locator('[data-progress-total]')).toHaveText('+28,4 %')
  await expect(karte.locator('[data-progress-area]')).toHaveCount(3)
  await expect(karte.locator('[data-progress-area="training"]')).toContainText('−4,2 %')
  await expect(karte.locator('[data-progress-area-toggle]')).toHaveCount(0)
  await expect(karte.locator('[data-progress-open]')).toHaveCount(0)
  await expect(page.locator('[data-progress-value]')).toHaveCount(0)
  await expect(page.locator('[data-vis-chip]')).toHaveCount(0)
  await expect(page.locator('[data-zeitreise]')).toHaveCount(0)
  await expect(page.getByText('18,6')).toHaveCount(0)
  await expect(page.locator('[data-badges-card] [data-badge]')).toHaveCount(2)
  await expect(page.locator('[data-badges-all]')).toHaveCount(0)

  // Ohne Freigabe: keine der beiden Karten
  mock.table('profiles').find(row => row.id === MAX_ID)!.field_visibility = { progress: 'friends' }
  await page.reload()
  await expect(page.locator('[data-profile-bar]')).toContainText('@max')
  await expect(page.locator('[data-progress-card]')).toHaveCount(0)
  await expect(page.locator('[data-badges-card]')).toHaveCount(0)
})

test('Alle Abzeichen: nach Gruppen, verdiente farbig, übrige mit Stand, Freunde-Abzeichen erst mit der Freunde-Funktion', async ({ page, mock }) => {
  evaMitFortschritt(mock)
  await page.goto('/profil')
  const karte = page.locator('[data-badges-card]')
  await expect(karte.locator('[data-vis-chip="badges"]')).toHaveText('Nur ich')
  await expect(karte.locator('[data-badge]').first()).toBeVisible()
  await karte.locator('[data-badges-all]').click()
  await expect(page).toHaveURL(/\/profil\/abzeichen$/)

  await expect(page.locator('[data-badge-group]')).toHaveCount(4)
  await expect(page.locator('[data-badge]')).toHaveCount(39)
  await expect(page.locator('[data-badge="streak_7"]')).toHaveAttribute('data-badge-earned', 'true')
  await expect(page.locator('[data-badge="first_pr"]')).toHaveAttribute('data-badge-earned', 'true')
  await expect(page.locator('[data-badge="workouts_10"]')).toHaveAttribute('data-badge-earned', 'true')
  await expect(page.locator('[data-badge="workouts_50"] [data-badge-progress]')).toHaveText('12/50')
  await expect(page.locator('[data-badge="first_friend"]')).toHaveAttribute('data-badge-earned', 'false')
  await expect(page.locator('[data-badge="first_friend"] [data-badge-progress]')).toHaveText('ab Freunde-Funktion')
  // Neu verdiente werden mit Tag gespeichert, gespeicherte behalten ihren Tag
  await expect.poll(() => (settings(mock).earned_badges as Record<string, string>).workouts_10).toBe('2026-09-18')
  expect((settings(mock).earned_badges as Record<string, string>).streak_7).toBe('2026-03-21')
})
